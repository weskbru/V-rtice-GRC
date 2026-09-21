/**
 * T156 — `PerformTransitionUseCase` (ADR-006, FR-080, FR-081, FR-083,
 * FR-084, FR-085, ADR-013). `POST /risks/{riskId}/transitions`
 * (`contracts/risks.openapi.yaml`'s `transitionRisk` operation) for every
 * DIRECT, non-approval-gated transition. A gated target (`ACCEPTED`/
 * `CLOSED`) is refused here with 422 — `RequestApprovalUseCase`/
 * `DecideApprovalUseCase` (T157) are the only path that ever applies one of
 * those.
 *
 * ## Why permission is checked here, not by `@RequirePermission` on the route
 *
 * `POST /risks/{riskId}/transitions` is ONE route serving every legal
 * `(from, to)` pair, and each pair names a DIFFERENT required permission
 * (`domain/risk-lifecycle.ts`'s own table) — `risk:edit` for leaving
 * `DRAFT`, `risk:assess` for entering `ASSESSED`, `risk:treat` for
 * `UNDER_TREATMENT`, `risk:transition` for `UNDER_REVIEW`/the gated
 * targets, `risk:administer` for `ARCHIVED`. A single static
 * `@RequirePermission` decorator cannot express "the permission depends on
 * the request body", so `lifecycle.controller.ts` marks this route
 * `@NoPermissionRequired()` (any authenticated user may attempt any
 * transition) and THIS use case performs the real, per-pair check via
 * `PermissionResolverService` — the same centralized authorization
 * mechanism `PermissionGuard` itself uses (ADR-003), just invoked one layer
 * down because the permission identifier is data, not a compile-time
 * constant, for this one endpoint.
 *
 * ## Order of checks (deliberate)
 *
 * 1. Resolve actor + scope; read the risk (FR-025/FR-030) — 404 if
 *    out-of-scope/missing.
 * 2. Look up the transition rule for `(risk.status, input.toStatus)` in the
 *    declarative table — 422 (FR-081) if absent. This runs BEFORE the
 *    permission check because there is no permission identifier to check
 *    against an undefined rule.
 * 3. Permission check against `rule.requiredPermission` — 403
 *    (`ForbiddenDomainError`) if the actor lacks it.
 * 4. Refuse a gated rule outright — 422, "use the approvals endpoint"
 *    (FR-029).
 * 5. Evaluate `rule.preconditions` (T155) — 422 naming what is unmet if any
 *    fail (FR-081, US6 AS3).
 * 6. FR-084: `assertBusinessContentEditable`'s locked-status set does NOT
 *    apply here — a `CLOSED`/`ARCHIVED` risk simply has no OUTGOING legal
 *    transition in the table except `CLOSED -> ARCHIVED` itself, so step 2
 *    already refuses everything else with 422 (FR-081) without a separate
 *    check duplicating the same rule.
 * 7. One transaction (`TransactionRunnerPort`, same pattern as every other
 *    risk-mutating use case in this module): insert the
 *    `RiskLifecycleTransition` row, then
 *    `RiskRepositoryPort.applyLifecycleTransition` — a single conditional
 *    `UPDATE ... WHERE id = ? AND version = ?` (ADR-013) that ALSO makes
 *    FR-085 hold: a lost race here throws, rolling back the WHOLE
 *    transaction including the transition `INSERT` that ran first, so a
 *    lost optimistic-lock race never leaves an orphaned transition record
 *    or a double-applied status change. Finally, `AuditRecorder.record(...)`
 *    in the same transaction (ADR-005).
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType, type RiskStatus } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  ForbiddenDomainError,
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { RiskLifecycleTransitionRepositoryPort } from '../domain/ports/risk-lifecycle-transition-repository.port';
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';
import { findLifecycleTransition } from '../domain/risk-lifecycle';
import { evaluatePreconditions } from '../domain/transition-preconditions';

import { resolveReassessedDuringReview } from './lifecycle/reassessed-during-review';

import type { LifecycleTransitionRecord } from '../domain/ports/risk-lifecycle-transition-repository.port';
import type { RiskRecord } from '../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';

export interface PerformTransitionInput {
  readonly actorUserId: string;
  readonly riskId: string;
  /** From the `If-Match` header (ADR-013). */
  readonly expectedVersion: number;
  readonly toStatus: RiskStatus;
  readonly justification?: string | null | undefined;
}

export interface PerformTransitionResult {
  readonly transition: LifecycleTransitionRecord;
  readonly risk: RiskRecord;
}

@Injectable()
export class PerformTransitionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly transitionRepository: RiskLifecycleTransitionRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: PerformTransitionInput): Promise<PerformTransitionResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    // F-38: recorded server-side, via `assertExistingRecordAccessible`,
    // whenever the risk actually exists outside `scope` — the 404 stays
    // identical to the genuinely-missing case either way.
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

    const rule = findLifecycleTransition(current.status, input.toStatus);
    if (!rule) {
      throw new ValidationDomainError(USER_MESSAGES.risk.lifecycle.transitionNotAllowed, [
        { field: 'toStatus', message: USER_MESSAGES.risk.lifecycle.transitionNotAllowed },
      ]);
    }

    const allowed = await this.permissionResolver.hasPermission(
      input.actorUserId,
      rule.requiredPermission,
    );
    if (!allowed) {
      throw new ForbiddenDomainError();
    }

    if (rule.requiresApproval) {
      throw new ValidationDomainError(USER_MESSAGES.risk.lifecycle.transitionRequiresApproval, [
        { field: 'toStatus', message: USER_MESSAGES.risk.lifecycle.transitionRequiresApproval },
      ]);
    }

    const reassessedDuringReview = await resolveReassessedDuringReview(
      this.transitionRepository,
      current,
    );
    const preconditionResults = evaluatePreconditions(rule.preconditions, {
      risk: current,
      reassessedDuringReview,
    });
    const unmet = preconditionResults.filter((result) => !result.met);
    if (unmet.length > 0) {
      throw new ValidationDomainError(
        unmet[0]!.message,
        unmet.map((result) => ({ field: 'toStatus', message: result.message })),
      );
    }

    const justification = input.justification ?? null;

    return this.transactionRunner.run(async () => {
      const transition = await this.transitionRepository.create({
        riskId: input.riskId,
        fromStatus: current.status,
        toStatus: input.toStatus,
        performedByUserId: input.actorUserId,
        justification,
      });

      const result = await this.riskRepository.applyLifecycleTransition(
        scope,
        input.riskId,
        input.expectedVersion,
        {
          status: input.toStatus,
          ...(input.toStatus === 'ARCHIVED' ? { archivedAt: new Date() } : {}),
        },
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

      await this.auditRecorder.record({
        action: 'risk.transitioned',
        entityType: AuditEntityType.RISK_LIFECYCLE_TRANSITION,
        entityId: transition.id,
        actorLabel: actor.fullName,
        newValues: {
          riskId: input.riskId,
          fromStatus: transition.fromStatus,
          toStatus: transition.toStatus,
          justification,
        },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return { transition, risk: result.record };
    });
  }
}
