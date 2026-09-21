/**
 * T157 — `RequestApprovalUseCase` (ADR-006, FR-029, FR-029c, FR-029d,
 * ADR-013). `POST /risks/{riskId}/approvals`
 * (`contracts/risks.openapi.yaml`'s `requestRiskApproval` operation).
 * Requires `risk:transition` — enforced statically by
 * `@RequirePermission('risk:transition')` on the controller route, since
 * every approval-gated row in the transition table names the SAME
 * permission to request it (`domain/risk-lifecycle.ts`'s own header
 * explains why "request" and "decide" are always distinct permissions).
 *
 * ## FR-029c — the risk stays exactly where it is
 *
 * This use case NEVER writes `Risk.status`. It writes `pendingApprovalId`
 * only, via the SAME version-gated `applyLifecycleTransition` mechanism
 * every other lifecycle write uses (ADR-013) — "awaiting approval is an
 * explicit condition on the record, not a ninth state" (the contract's own
 * words). Applying the transition itself is `DecideApprovalUseCase`'s job,
 * on `APPROVED` only.
 *
 * ## Two independent guards against a double-pending approval
 *
 * `current.pendingApprovalId !== undefined` is checked here, in the
 * application layer, before ever inserting a row — but the
 * `approvals_one_pending_per_entity` partial unique index
 * (`20260905170100_risk_lifecycle_and_approvals_baseline`) is what actually
 * makes this race-free: two simultaneous requests could both pass this
 * in-memory check before either commits, and the SECOND `INSERT` (whichever
 * one loses the race) fails on the unique index instead, which this method
 * maps to the SAME 409 `ConflictDomainError`.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType, type RiskStatus } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import {
  ConflictDomainError,
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { ApprovalRepositoryPort } from '../../domain/ports/approval-repository.port';
import { RiskReferenceDataPort } from '../../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { findLifecycleTransition } from '../../domain/risk-lifecycle';
import { evaluatePreconditions } from '../../domain/transition-preconditions';

import type { ApprovalRecord } from '../../domain/ports/approval-repository.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';

export interface RequestApprovalInput {
  readonly actorUserId: string;
  readonly riskId: string;
  /** From the `If-Match` header (ADR-013). */
  readonly expectedVersion: number;
  /** The only gated targets in this release (FR-029). */
  readonly toStatus: Extract<RiskStatus, 'ACCEPTED' | 'CLOSED'>;
  readonly justification?: string | null | undefined;
}

export interface RequestApprovalResult {
  readonly approval: ApprovalRecord;
  readonly risk: RiskRecord;
}

@Injectable()
export class RequestApprovalUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly approvalRepository: ApprovalRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: RequestApprovalInput): Promise<RequestApprovalResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.riskRepository.findById(scope, input.riskId);
    if (!current) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    const rule = findLifecycleTransition(current.status, input.toStatus);
    if (!rule?.requiresApproval) {
      throw new ValidationDomainError(USER_MESSAGES.risk.lifecycle.transitionNotApprovalGated, [
        { field: 'toStatus', message: USER_MESSAGES.risk.lifecycle.transitionNotApprovalGated },
      ]);
    }

    const preconditionResults = evaluatePreconditions(rule.preconditions, {
      risk: current,
      // Gated rows never declare `REASSESSED_DURING_REVIEW` (only the
      // UNDER_REVIEW -> ASSESSED return path does) — irrelevant here.
      reassessedDuringReview: false,
    });
    const unmet = preconditionResults.filter((result) => !result.met);
    if (unmet.length > 0) {
      throw new ValidationDomainError(
        unmet[0]!.message,
        unmet.map((result) => ({ field: 'toStatus', message: result.message })),
      );
    }

    if (current.pendingApprovalId !== undefined) {
      throw new ConflictDomainError(USER_MESSAGES.risk.lifecycle.approvalAlreadyPending);
    }

    const requestedTransition = `${current.status}->${input.toStatus}`;
    const justification = input.justification ?? null;

    return this.transactionRunner.run(async () => {
      const approval = await this.approvalRepository.create({
        entityType: 'RISK',
        entityId: input.riskId,
        requestedTransition,
        requestedByUserId: input.actorUserId,
        justification,
      });

      const result = await this.riskRepository.applyLifecycleTransition(
        scope,
        input.riskId,
        input.expectedVersion,
        { pendingApprovalId: approval.id },
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
        action: 'risk.approval_requested',
        entityType: AuditEntityType.APPROVAL,
        entityId: approval.id,
        actorLabel: actor.fullName,
        newValues: { riskId: input.riskId, requestedTransition, justification },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return { approval, risk: result.record };
    });
  }
}
