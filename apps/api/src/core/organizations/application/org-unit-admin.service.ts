/**
 * T178 — organizational-unit administration
 * (`contracts/admin.openapi.yaml`'s `Organizational Units` tag; ADR-004,
 * FR-024, FR-060, FR-102).
 *
 * ## Materialized-path maintenance and cycle prevention
 *
 * All path arithmetic is delegated to the pure functions already published
 * in `domain/org-unit-path.ts` (T038) — `computeRootPath`/`computeChildPath`
 * for creation, `canReparent`/`recomputeSubtreePaths` for reparenting. This
 * service's job is only to fetch the real rows those functions need and to
 * persist their output inside one transaction (`applyReparent` updates the
 * moved unit AND every descendant together, data-model.md §4: "the subtree
 * updated ... in the same transaction").
 *
 * A unit's own `id` must be known BEFORE its row is inserted, because the
 * materialized path embeds it (`computeChildPath`/`computeRootPath`) —
 * unlike every other entity in this codebase, which lets
 * `schema.prisma`'s `@default(uuid(7))` generate the id at insert time,
 * this service generates it itself with `randomUUID()` first, exactly the
 * pattern `test/integration/support/fixtures.ts`'s `createOrgUnitFixture`
 * already establishes for the same reason.
 *
 * ## "Become root" as a reparent target
 *
 * `UpdateOrgUnitRequest.parentId: [string, 'null']` allows reparenting to
 * root (`null`). `canReparent`/`recomputeSubtreePaths` both expect a
 * concrete parent's path/depth — there is no real "root" row to fetch, so
 * `ROOT_PARENT_SENTINEL` stands in for one: `{ path: '/', depth: -1 }`
 * makes `recomputeSubtreePaths`'s arithmetic (`newPath = parent.path +
 * unit.id + '/'`, `newDepth = parent.depth + 1`) produce exactly
 * `computeRootPath`'s own output (`/{id}/`, depth `0`) without a special
 * case in that pure module. Its `id` is a fixed non-UUID string so it can
 * never collide with `canReparent`'s `unit.id === newParent.id` cycle
 * check against a real unit.
 */
import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { AuditEntityType, AuditOutcome, type OrgUnitStatus } from '@prisma/client';

import {
  ConflictDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import {
  canReparent,
  computeChildPath,
  computeRootPath,
  recomputeSubtreePaths,
  type OrgUnitPathInfo,
} from '../domain/org-unit-path';
import { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import { OrgScopeRepositoryPort } from '../domain/ports/org-scope-repository.port';
import {
  OrgUnitAdminRepositoryPort,
  type OrgUnitAdminRecord,
} from '../domain/ports/org-unit-admin-repository.port';

const ORG_UNIT_ENTITY_LABEL = 'Unidade organizacional';

/** See file header — stands in for "root" when reparenting to `parentId:
 * null`. Never persisted; only ever passed to `domain/org-unit-path.ts`'s
 * pure functions. */
const ROOT_PARENT_SENTINEL: OrgUnitPathInfo = { id: '__root__', path: '/', depth: -1 };

export interface CreateOrgUnitCommand {
  readonly actorUserId: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | undefined;
}

export interface UpdateOrgUnitCommand {
  readonly actorUserId: string;
  readonly orgUnitId: string;
  readonly code?: string;
  readonly name?: string;
  /** Present (including `null`, meaning "become a root unit") triggers a
   * reparent; absent leaves the unit where it is. Distinguishing "absent"
   * from "null" is why this is `string | null | undefined` rather than
   * `string | undefined`. */
  readonly parentId?: string | null;
}

export interface SetOrgUnitStatusCommand {
  readonly actorUserId: string;
  readonly orgUnitId: string;
  readonly status: OrgUnitStatus;
}

@Injectable()
export class OrgUnitAdminService {
  constructor(
    private readonly repository: OrgUnitAdminRepositoryPort,
    private readonly scopeRepository: OrgScopeRepositoryPort,
    private readonly actorDirectory: ActorDirectoryPort,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async list(status: OrgUnitStatus | undefined): Promise<readonly OrgUnitAdminRecord[]> {
    return this.repository.listAll(status);
  }

  async getById(orgUnitId: string): Promise<OrgUnitAdminRecord> {
    const unit = await this.repository.findById(orgUnitId);
    if (!unit) {
      throw new NotFoundDomainError(ORG_UNIT_ENTITY_LABEL, orgUnitId);
    }
    return unit;
  }

  async create(command: CreateOrgUnitCommand): Promise<OrgUnitAdminRecord> {
    const actorLabel = await this.resolveActorLabel(command.actorUserId);

    const codeConflict = await this.repository.findByCode(command.code);
    if (codeConflict) {
      throw new ConflictDomainError(USER_MESSAGES.admin.orgUnitCodeAlreadyInUse);
    }

    const newId = randomUUID();
    const pathInfo = command.parentId
      ? computeChildPath(await this.requireActiveParentPathInfo(command.parentId), newId)
      : computeRootPath(newId);

    return this.transactionRunner.run(async () => {
      const unit = await this.repository.create({
        id: newId,
        code: command.code,
        name: command.name,
        parentId: command.parentId,
        path: pathInfo.path,
        depth: pathInfo.depth,
      });

      // US8 AS4: access scoping reflects the new structure immediately — a
      // caller already holding a UNIT grant on the (now) parent must see
      // this new unit on their next scope resolution.
      await this.scopeRepository.bumpOrgTreeVersion();

      await this.auditRecorder.record({
        action: 'org_unit.created',
        entityType: AuditEntityType.ORGANIZATIONAL_UNIT,
        entityId: unit.id,
        actorLabel,
        newValues: {
          code: unit.code,
          name: unit.name,
          parentId: unit.parentId ?? null,
          path: unit.path,
          depth: unit.depth,
          status: unit.status,
        },
        organizationalUnitId: unit.id,
        outcome: AuditOutcome.SUCCESS,
      });

      return unit;
    });
  }

  async update(command: UpdateOrgUnitCommand): Promise<OrgUnitAdminRecord> {
    const actorLabel = await this.resolveActorLabel(command.actorUserId);
    await this.getById(command.orgUnitId);

    if (command.code !== undefined) {
      const conflict = await this.repository.findByCode(command.code, command.orgUnitId);
      if (conflict) {
        throw new ConflictDomainError(USER_MESSAGES.admin.orgUnitCodeAlreadyInUse);
      }
    }

    // `parentId` present (`'parentId' in command`-equivalent, expressed via
    // `!== undefined` since the DTO only ever omits the key or sends a
    // concrete value/`null`) is a reparent request.
    const isReparentRequested = command.parentId !== undefined;
    const newParentPathInfo = isReparentRequested
      ? command.parentId === null
        ? ROOT_PARENT_SENTINEL
        : await this.requireActiveParentPathInfo(command.parentId)
      : undefined;

    await this.transactionRunner.run(async () => {
      if (command.code !== undefined || command.name !== undefined) {
        const previous = await this.repository.updateFields(command.orgUnitId, {
          ...(command.code !== undefined ? { code: command.code } : {}),
          ...(command.name !== undefined ? { name: command.name } : {}),
        });
        await this.auditRecorder.record({
          action: 'org_unit.updated',
          entityType: AuditEntityType.ORGANIZATIONAL_UNIT,
          entityId: command.orgUnitId,
          actorLabel,
          previousValues: {
            ...(command.code !== undefined ? { code: previous?.code } : {}),
            ...(command.name !== undefined ? { name: previous?.name } : {}),
          },
          newValues: {
            ...(command.code !== undefined ? { code: command.code } : {}),
            ...(command.name !== undefined ? { name: command.name } : {}),
          },
          organizationalUnitId: command.orgUnitId,
          outcome: AuditOutcome.SUCCESS,
        });
      }

      if (newParentPathInfo !== undefined) {
        await this.performReparent(command.orgUnitId, newParentPathInfo, actorLabel);
      }
    });

    return this.getById(command.orgUnitId);
  }

  async setStatus(command: SetOrgUnitStatusCommand): Promise<OrgUnitAdminRecord> {
    const actorLabel = await this.resolveActorLabel(command.actorUserId);
    const unit = await this.getById(command.orgUnitId);

    if (command.status === 'INACTIVE' && (await this.repository.hasActiveDescendant(unit.path))) {
      throw new ValidationDomainError(USER_MESSAGES.admin.orgUnitHasActiveDescendant);
    }

    await this.transactionRunner.run(async () => {
      const previousStatus = await this.repository.setStatus(command.orgUnitId, command.status);
      await this.auditRecorder.record({
        action: command.status === 'ACTIVE' ? 'org_unit.activated' : 'org_unit.deactivated',
        entityType: AuditEntityType.ORGANIZATIONAL_UNIT,
        entityId: command.orgUnitId,
        actorLabel,
        previousValues: { status: previousStatus },
        newValues: { status: command.status },
        organizationalUnitId: command.orgUnitId,
        outcome: AuditOutcome.SUCCESS,
      });
    });

    return this.getById(command.orgUnitId);
  }

  /**
   * Reparents `unitId` under `newParentPathInfo` — cycle prevention
   * (refused with `422`) plus the subtree path/depth rewrite, in one
   * ambient transaction. Must be called from inside the caller's
   * `transactionRunner.run(...)` scope.
   */
  private async performReparent(
    unitId: string,
    newParentPathInfo: OrgUnitPathInfo,
    actorLabel: string,
  ): Promise<void> {
    const previousUnit = await this.repository.findById(unitId);
    const unitPathInfo = await this.repository.findPathInfoById(unitId);
    if (!previousUnit || !unitPathInfo) {
      // Defensive only: `getById` in `update()` already proved the unit
      // exists moments earlier, inside the same transaction.
      throw new NotFoundDomainError(ORG_UNIT_ENTITY_LABEL, unitId);
    }

    if (!canReparent(unitPathInfo, newParentPathInfo)) {
      throw new ValidationDomainError(USER_MESSAGES.admin.reparentWouldCreateCycle);
    }

    const descendants = await this.repository.findStrictDescendantsPathInfo(unitPathInfo.path);
    const recomputed = recomputeSubtreePaths(unitPathInfo, newParentPathInfo, descendants);
    const newParentId =
      newParentPathInfo.id === ROOT_PARENT_SENTINEL.id ? undefined : newParentPathInfo.id;

    await this.repository.applyReparent({
      unitId,
      parentId: newParentId,
      path: recomputed.movedUnit.path,
      depth: recomputed.movedUnit.depth,
      descendants: recomputed.updatedDescendants,
    });

    // FR-025b: resolved scopes are recomputed — risks may move in or out
    // of a user's reach on their next request.
    await this.scopeRepository.bumpOrgTreeVersion();

    await this.auditRecorder.record({
      action: 'org_unit.reparented',
      entityType: AuditEntityType.ORGANIZATIONAL_UNIT,
      entityId: unitId,
      actorLabel,
      previousValues: {
        parentId: previousUnit.parentId ?? null,
        path: previousUnit.path,
        depth: previousUnit.depth,
      },
      newValues: {
        parentId: newParentId ?? null,
        path: recomputed.movedUnit.path,
        depth: recomputed.movedUnit.depth,
      },
      organizationalUnitId: unitId,
      outcome: AuditOutcome.SUCCESS,
    });
  }

  private async requireActiveParentPathInfo(parentId: string): Promise<OrgUnitPathInfo> {
    const parent = await this.repository.findById(parentId);
    const parentPathInfo = await this.repository.findPathInfoById(parentId);
    if (!parent || !parentPathInfo || parent.status !== 'ACTIVE') {
      throw new ValidationDomainError(USER_MESSAGES.admin.parentOrgUnitNotFound);
    }
    return parentPathInfo;
  }

  /** Defensive-only failure path (see `create-risk.usecase.ts`'s identical
   * reasoning): `SessionGuard` already proved this actor has a live
   * session. */
  private async resolveActorLabel(actorUserId: string): Promise<string> {
    const label = await this.actorDirectory.findActorLabel(actorUserId);
    if (!label) {
      throw new UnauthorizedDomainError();
    }
    return label;
  }
}
