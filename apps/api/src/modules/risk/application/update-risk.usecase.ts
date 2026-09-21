/**
 * T090 — `UpdateRiskUseCase`: partial business-content update with
 * per-field audit (FR-033, FR-058) and optimistic-lock conflict detection
 * (FR-103, ADR-013).
 *
 * ## Shape of `UpdateRiskInput`
 *
 * A field's TypeScript value distinguishes exactly the three states
 * `contracts/risks.openapi.yaml`'s `UpdateRiskRequest` defines: **absent**
 * (`undefined` — "omitted properties are left unchanged"), **explicitly
 * cleared** (`null`, only for the fields the schema types `[string,
 * 'null']`), and **supplied** (a real value). JSON itself has no
 * `undefined` literal, so a JSON body's key either exists (`null` or a
 * value) or does not (`undefined` once mapped onto this interface) — the
 * presentation-layer DTO->input mapping (`risk.controller.ts`) relies on
 * exactly this to preserve the distinction all the way from the wire.
 *
 * ## Same transaction-boundary reasoning as `CreateRiskUseCase`
 *
 * See that file's header — this class likewise depends on
 * `TransactionRunnerPort`, never `PrismaService`, so the conditional update
 * and its audit entry share one transaction without violating ADR-011.
 *
 * ## Why the diff is field-by-field rather than "always audit +
 * merged inputs"
 *
 * `AuditRecorder`/`applyAuditFieldAllowlist` drop unlisted fields but do
 * NOT drop fields whose old and new value are equal — writing every
 * supplied field into `previousValues`/`newValues` regardless of whether it
 * actually changed would put a "changed" `title` in the trail even when a
 * caller re-submitted the same title unchanged (FR-033's "field changes",
 * not "fields submitted"). Each `diff*` call below therefore ALWAYS looks
 * at the record's CURRENT (pre-update) value before deciding whether a
 * field is part of the change set at all.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
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
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';
import { assertBusinessContentEditable } from '../domain/risk.entity';

import { isOrgUnitWithinScope, parseIsoDate } from './create-risk.usecase';

import type { UpdateRiskChanges, RiskRecord } from '../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';

export interface UpdateRiskInput {
  readonly actorUserId: string;
  readonly riskId: string;
  /** From the `If-Match` header (ADR-013). */
  readonly expectedVersion: number;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly categoryId?: string | null | undefined;
  readonly typeId?: string | null | undefined;
  readonly originId?: string | null | undefined;
  readonly orgUnitId?: string | undefined;
  readonly ownerUserId?: string | undefined;
  readonly responsibleUserId?: string | null | undefined;
  readonly identifiedOn?: string | undefined;
  readonly nextReviewOn?: string | null | undefined;
}

@Injectable()
export class UpdateRiskUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly assignmentLine: AssignmentLineService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UpdateRiskInput): Promise<RiskRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    // FR-025/FR-030: scoped read — a risk outside the caller's scope reads
    // as `undefined`, indistinguishable from "does not exist" to the
    // caller. F-38: recorded server-side, via
    // `assertExistingRecordAccessible`, whenever the risk actually exists
    // outside `scope`.
    const current = await this.riskRepository.findById(scope, input.riskId);
    if (!current) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          entityLabel: RISK_ENTITY_LABEL,
        },
        () => this.riskRepository.findOrgUnitIdUnscoped(input.riskId),
      );
    }

    // FR-084 — the domain rule, not a controller check.
    assertBusinessContentEditable(current.status);

    // `UpdateRiskChanges`'s fields are `readonly` at its public port boundary
    // (`domain/ports/risk-repository.port.ts` — callers must not mutate a
    // value they received); building one up field-by-field here is
    // construction, not mutation of an existing value, so a locally-mutable
    // view of the same shape is used instead of fighting `readonly` with
    // an `any`/`as` escape hatch.
    const changes: { -readonly [K in keyof UpdateRiskChanges]: UpdateRiskChanges[K] } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.title !== undefined && input.title !== current.title) {
      changes.title = input.title;
      previousValues.title = current.title;
      newValues.title = input.title;
    }

    if (input.description !== undefined && input.description !== current.description) {
      changes.description = input.description;
      previousValues.description = current.description;
      newValues.description = input.description;
    }

    if (input.categoryId !== undefined) {
      const currentCategoryId = current.category?.id ?? null;
      if (input.categoryId !== currentCategoryId) {
        if (input.categoryId !== null) {
          await this.assertReferenceActive(
            () => this.referenceData.findCategory(input.categoryId!),
            USER_MESSAGES.risk.categoryNotFound,
            'categoryId',
          );
        }
        changes.categoryId = input.categoryId;
        previousValues.categoryId = currentCategoryId;
        newValues.categoryId = input.categoryId;
      }
    }

    if (input.typeId !== undefined) {
      const currentTypeId = current.type?.id ?? null;
      if (input.typeId !== currentTypeId) {
        if (input.typeId !== null) {
          await this.assertReferenceActive(
            () => this.referenceData.findType(input.typeId!),
            USER_MESSAGES.risk.typeNotFound,
            'typeId',
          );
        }
        changes.typeId = input.typeId;
        previousValues.typeId = currentTypeId;
        newValues.typeId = input.typeId;
      }
    }

    if (input.originId !== undefined) {
      const currentOriginId = current.origin?.id ?? null;
      if (input.originId !== currentOriginId) {
        if (input.originId !== null) {
          await this.assertReferenceActive(
            () => this.referenceData.findOrigin(input.originId!),
            USER_MESSAGES.risk.originNotFound,
            'originId',
          );
        }
        changes.originId = input.originId;
        previousValues.originId = currentOriginId;
        newValues.originId = input.originId;
      }
    }

    if (input.orgUnitId !== undefined && input.orgUnitId !== current.orgUnit.id) {
      // FR-025c applies to reassignment exactly as it applies to creation.
      const orgUnit = await this.referenceData.findOrgUnit(input.orgUnitId);
      if (!orgUnit?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.risk.orgUnitNotFound, [
          { field: 'orgUnitId', message: USER_MESSAGES.risk.orgUnitNotFound },
        ]);
      }
      if (!isOrgUnitWithinScope(scope, input.orgUnitId)) {
        throw new ValidationDomainError(USER_MESSAGES.risk.orgUnitOutOfScope, [
          { field: 'orgUnitId', message: USER_MESSAGES.risk.orgUnitOutOfScope },
        ]);
      }
      changes.orgUnitId = input.orgUnitId;
      previousValues.orgUnitId = current.orgUnit.id;
      newValues.orgUnitId = input.orgUnitId;
    }

    // The assignment line must be resolved against the org unit the risk
    // will HAVE after this update, not the one it had before — `changes`
    // already carries the new `orgUnitId` at this point if it is changing
    // (the block above runs first). A move that leaves the current
    // owner/responsible no longer assignable in the destination unit is
    // refused exactly as a new, unassignable owner would be — computed
    // lazily so an update that touches neither the org unit nor the
    // owner/responsible fields never pays for the lookup.
    const finalOrgUnitId = changes.orgUnitId ?? current.orgUnit.id;
    const orgUnitChanging = changes.orgUnitId !== undefined;
    let assignableUnitIds: ReadonlySet<string> | undefined;
    const resolveAssignableUnitIds = async (): Promise<ReadonlySet<string>> => {
      // `finalOrgUnitId` was already proved to exist and be active either
      // now (the org-unit block above) or when the risk was originally
      // created — the `?? new Set()` fallback is defensive-only and fails
      // closed, exactly like `CreateRiskUseCase`'s own fallback.
      assignableUnitIds ??=
        (await this.assignmentLine.resolveUnitIds(finalOrgUnitId)) ?? new Set<string>();
      return assignableUnitIds;
    };

    const ownerChanging = input.ownerUserId !== undefined && input.ownerUserId !== current.owner.id;
    if (ownerChanging || orgUnitChanging) {
      const resultingOwnerUserId = input.ownerUserId ?? current.owner.id;
      await this.assertUserAssignable(
        resultingOwnerUserId,
        await resolveAssignableUnitIds(),
        finalOrgUnitId,
        USER_MESSAGES.risk.ownerNotFound,
        USER_MESSAGES.risk.ownerNotAssignable,
        USER_MESSAGES.risk.ownerNotVisible,
        'ownerUserId',
      );
    }
    if (ownerChanging) {
      changes.ownerUserId = input.ownerUserId;
      previousValues.ownerUserId = current.owner.id;
      newValues.ownerUserId = input.ownerUserId;
    }

    if (input.responsibleUserId !== undefined) {
      const currentResponsibleId = current.responsible?.id ?? null;
      if (input.responsibleUserId !== currentResponsibleId) {
        if (input.responsibleUserId !== null) {
          await this.assertUserAssignable(
            input.responsibleUserId,
            await resolveAssignableUnitIds(),
            finalOrgUnitId,
            USER_MESSAGES.risk.responsibleNotFound,
            USER_MESSAGES.risk.responsibleNotAssignable,
            USER_MESSAGES.risk.responsibleNotVisible,
            'responsibleUserId',
          );
        }
        changes.responsibleUserId = input.responsibleUserId;
        previousValues.responsibleUserId = currentResponsibleId;
        newValues.responsibleUserId = input.responsibleUserId;
      }
    } else if (orgUnitChanging && current.responsible) {
      // Responsible person left untouched by this request, but the risk is
      // moving units: the existing responsible person must still be
      // assignable in the destination unit.
      await this.assertUserAssignable(
        current.responsible.id,
        await resolveAssignableUnitIds(),
        finalOrgUnitId,
        USER_MESSAGES.risk.responsibleNotFound,
        USER_MESSAGES.risk.responsibleNotAssignable,
        USER_MESSAGES.risk.responsibleNotVisible,
        'responsibleUserId',
      );
    }

    if (input.identifiedOn !== undefined) {
      const parsed = parseIsoDate(input.identifiedOn);
      if (parsed.getTime() !== current.identifiedOn.getTime()) {
        changes.identifiedOn = parsed;
        previousValues.identifiedOn = current.identifiedOn;
        newValues.identifiedOn = parsed;
      }
    }

    if (input.nextReviewOn !== undefined) {
      const parsed = input.nextReviewOn === null ? null : parseIsoDate(input.nextReviewOn);
      const currentTime = current.nextReviewOn?.getTime();
      const parsedTime = parsed?.getTime();
      if (parsedTime !== currentTime) {
        changes.nextReviewOn = parsed;
        previousValues.nextReviewOn = current.nextReviewOn ?? null;
        newValues.nextReviewOn = parsed;
      }
    }

    return this.transactionRunner.run(async () => {
      const result = await this.riskRepository.updateWithVersion(
        scope,
        input.riskId,
        input.expectedVersion,
        changes,
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
      }

      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          RISK_ENTITY_LABEL,
          input.riskId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      // Only audit when something actually changed — an idempotent PATCH
      // re-submitting the current values still succeeds (200), but leaves
      // no misleading "nothing changed" audit row.
      if (Object.keys(newValues).length > 0) {
        await this.auditRecorder.record({
          action: 'risk.updated',
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          actorLabel: actor.fullName,
          previousValues,
          newValues,
          organizationalUnitId: result.record.orgUnit.id,
        });
      }

      return result.record;
    });
  }

  /**
   * See `CreateRiskUseCase.assertUserAssignable`'s own doc comment — the
   * exact same rule, duplicated rather than shared for the same reason
   * `assertReferenceActive` already is: each use case owns its narrow,
   * single-implementation lookup logic, and there is no third caller yet
   * that would justify extracting a shared helper. This includes F-CV-2's
   * visibility check (`risk:view` + scope reaching `orgUnitId`, against the
   * CANDIDATE, not the caller) — same predicate, same reasoning, same
   * duplication policy.
   *
   * ## Only reached when the field is actually being set or changed
   *
   * Every call site above only reaches this method when `ownerChanging`,
   * `orgUnitChanging`, or the responsible field is itself present and
   * different from its current value — never merely because SOME other
   * field on the PATCH changed. A risk created before this rule existed can
   * carry an owner/responsible who would now fail it; editing that risk's
   * title, description or any other untouched field must keep working, and
   * does, because this method is simply never invoked for that request.
   */
  private async assertUserAssignable(
    userId: string,
    assignmentLine: ReadonlySet<string>,
    orgUnitId: string,
    notFoundMessage: string,
    notAssignableMessage: string,
    notVisibleMessage: string,
    field: string,
  ): Promise<void> {
    const user = await this.referenceData.findUser(userId);
    if (!user?.isActive) {
      throw new ValidationDomainError(notFoundMessage, [{ field, message: notFoundMessage }]);
    }
    if (user.primaryOrgUnitId !== undefined && !assignmentLine.has(user.primaryOrgUnitId)) {
      throw new ValidationDomainError(notAssignableMessage, [
        { field, message: notAssignableMessage },
      ]);
    }

    const [canViewRisks, candidateScope] = await Promise.all([
      this.permissionResolver.hasPermission(userId, 'risk:view'),
      this.scopeResolver.resolveScope(userId),
    ]);
    if (!canViewRisks || !this.assignmentLine.isQuestionInScope(candidateScope, orgUnitId)) {
      throw new ValidationDomainError(notVisibleMessage, [{ field, message: notVisibleMessage }]);
    }
  }

  private async assertReferenceActive(
    lookup: () => Promise<{ isActive: boolean } | undefined>,
    message: string,
    field: string,
  ): Promise<void> {
    const reference = await lookup();
    if (!reference?.isActive) {
      throw new ValidationDomainError(message, [{ field, message }]);
    }
  }
}
