/**
 * T020/003-controls-management — `UpdateControlUseCase`: partial
 * business-content update with per-field audit (`PATCH
 * /controls/{controlId}`, `updateControl` operation, FR-008) and
 * optimistic-lock conflict detection (ADR-013). Mirrors
 * `modules/risk/application/update-risk.usecase.ts`'s structure — see that
 * file's header for the transaction-boundary/`UpdateControlInput`-shape
 * reasoning this one does not repeat.
 *
 * ## No lifecycle-status gate on editability
 *
 * Unlike Risk's `assertBusinessContentEditable` (which locks `CLOSED`/
 * `ARCHIVED`), neither the spec nor the contract restricts `PATCH` by the
 * control's current `status` — a `RETIRED` control stays "integralmente
 * legível" (FR-006) and the contract's `updateControl` description names
 * no status precondition. This is a considered decision, not an omission:
 * introducing a restriction the spec never asked for would be exactly the
 * "não implementar funcionalidades que não estejam especificadas" CLAUDE.md
 * §2 warns against.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { AssignmentLineService } from '../../../core/organizations/application/assignment-line.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { registerControlAuditAllowlists } from '../domain/control-audit-allowlist';
import { ControlReferenceDataPort } from '../domain/ports/control-reference-data.port';
import { ControlRepositoryPort } from '../domain/ports/control-repository.port';

import { isOrgUnitWithinScope } from './create-control.usecase';

import type { UpdateControlChanges, ControlRecord } from '../domain/ports/control-repository.port';
import type { ControlFrequency, ControlNature, ControlType } from '@prisma/client';

export interface UpdateControlInput {
  readonly actorUserId: string;
  readonly controlId: string;
  /** From the `If-Match` header (ADR-013). */
  readonly expectedVersion: number;
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly orgUnitId?: string | undefined;
  readonly ownerUserId?: string | null | undefined;
  readonly nature?: ControlNature | null | undefined;
  readonly type?: ControlType | null | undefined;
  readonly frequency?: ControlFrequency | null | undefined;
}

@Injectable()
export class UpdateControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly controlRepository: ControlRepositoryPort,
    private readonly referenceData: ControlReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly assignmentLine: AssignmentLineService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {
    registerControlAuditAllowlists();
  }

  async execute(input: UpdateControlInput): Promise<ControlRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const referenceDate = new Date();

    const current = await this.controlRepository.findById(scope, input.controlId, referenceDate);
    if (!current) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.CONTROL,
          entityId: input.controlId,
          entityLabel: USER_MESSAGES.controls.entityLabel,
        },
        () => this.controlRepository.findOrgUnitIdUnscoped(input.controlId),
      );
    }

    const changes: { -readonly [K in keyof UpdateControlChanges]: UpdateControlChanges[K] } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.name !== undefined && input.name !== current.name) {
      changes.name = input.name;
      previousValues.name = current.name;
      newValues.name = input.name;
    }

    if (input.description !== undefined && input.description !== current.description) {
      changes.description = input.description;
      previousValues.description = current.description;
      newValues.description = input.description;
    }

    if (input.orgUnitId !== undefined && input.orgUnitId !== current.orgUnit?.id) {
      const orgUnit = await this.referenceData.findOrgUnit(input.orgUnitId);
      if (!orgUnit?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.controls.orgUnitNotFound, [
          { field: 'orgUnitId', message: USER_MESSAGES.controls.orgUnitNotFound },
        ]);
      }
      if (!isOrgUnitWithinScope(scope, input.orgUnitId)) {
        throw new ValidationDomainError(USER_MESSAGES.controls.orgUnitOutOfScope, [
          { field: 'orgUnitId', message: USER_MESSAGES.controls.orgUnitOutOfScope },
        ]);
      }
      changes.orgUnitId = input.orgUnitId;
      previousValues.orgUnitId = current.orgUnit?.id ?? null;
      newValues.orgUnitId = input.orgUnitId;
    }

    // The assignment line must be resolved against the org unit the
    // control will HAVE after this update, not the one it had before —
    // `changes.orgUnitId` already carries the new value at this point if
    // it is changing (the block above runs first). Mirrors
    // `UpdateRiskUseCase`'s identical "resolve lazily, against the final
    // unit" reasoning.
    const finalOrgUnitId = changes.orgUnitId ?? current.orgUnit?.id;
    let assignableUnitIds: ReadonlySet<string> | undefined;
    const resolveAssignableUnitIds = async (): Promise<ReadonlySet<string>> => {
      if (!finalOrgUnitId) {
        return new Set<string>();
      }
      assignableUnitIds ??=
        (await this.assignmentLine.resolveUnitIds(finalOrgUnitId)) ?? new Set<string>();
      return assignableUnitIds;
    };

    if (input.ownerUserId !== undefined) {
      const currentOwnerId = current.owner?.id ?? null;
      if (input.ownerUserId !== currentOwnerId) {
        if (input.ownerUserId !== null) {
          await this.assertOwnerAssignable(input.ownerUserId, await resolveAssignableUnitIds());
        }
        changes.ownerUserId = input.ownerUserId;
        previousValues.ownerUserId = currentOwnerId;
        newValues.ownerUserId = input.ownerUserId;
      }
    } else if (changes.orgUnitId !== undefined && current.owner) {
      // Owner left untouched by this request, but the control is moving
      // units: the existing owner must still be assignable in the
      // destination unit.
      await this.assertOwnerAssignable(current.owner.id, await resolveAssignableUnitIds());
    }

    if (input.nature !== undefined && input.nature !== (current.nature ?? null)) {
      changes.nature = input.nature;
      previousValues.nature = current.nature ?? null;
      newValues.nature = input.nature;
    }

    if (input.type !== undefined && input.type !== (current.type ?? null)) {
      changes.type = input.type;
      previousValues.type = current.type ?? null;
      newValues.type = input.type;
    }

    if (input.frequency !== undefined && input.frequency !== (current.frequency ?? null)) {
      changes.frequency = input.frequency;
      previousValues.frequency = current.frequency ?? null;
      newValues.frequency = input.frequency;
    }

    return this.transactionRunner.run(async () => {
      const result = await this.controlRepository.updateWithVersion(
        scope,
        input.controlId,
        input.expectedVersion,
        changes,
        referenceDate,
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(USER_MESSAGES.controls.entityLabel, input.controlId);
      }

      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          USER_MESSAGES.controls.entityLabel,
          input.controlId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      // Only audit when something actually changed — an idempotent PATCH
      // re-submitting the current values still succeeds (200), but leaves
      // no misleading "nothing changed" audit row (same discipline
      // `UpdateRiskUseCase` documents).
      if (Object.keys(newValues).length > 0) {
        await this.auditRecorder.record({
          action: 'control.updated',
          entityType: AuditEntityType.CONTROL,
          entityId: input.controlId,
          actorLabel: actor.fullName,
          previousValues,
          newValues,
          organizationalUnitId: result.record.orgUnit?.id,
        });
      }

      return result.record;
    });
  }

  private async assertOwnerAssignable(
    ownerUserId: string,
    assignmentLine: ReadonlySet<string>,
  ): Promise<void> {
    const owner = await this.referenceData.findUser(ownerUserId);
    if (!owner?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.controls.ownerNotFound, [
        { field: 'ownerUserId', message: USER_MESSAGES.controls.ownerNotFound },
      ]);
    }
    if (owner.primaryOrgUnitId !== undefined && !assignmentLine.has(owner.primaryOrgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.controls.ownerNotAssignable, [
        { field: 'ownerUserId', message: USER_MESSAGES.controls.ownerNotAssignable },
      ]);
    }
  }
}
