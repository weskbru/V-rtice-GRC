/**
 * T157 — `DecideApprovalUseCase` (ADR-006, FR-029, FR-029a, FR-029b,
 * FR-029c, ADR-013). `POST /risks/{riskId}/approvals/{approvalId}/decision`
 * (`contracts/risks.openapi.yaml`'s `decideRiskApproval` operation).
 * Requires `risk:approve` — enforced statically by
 * `@RequirePermission('risk:approve')` on the controller route, DISTINCT
 * from the `risk:transition` permission `RequestApprovalUseCase` requires
 * (`domain/risk-lifecycle.ts`'s own header explains why this split is the
 * whole point of FR-029a).
 *
 * ## Segregation of duties — two layers, deliberately
 *
 * `assertApproverDiffersFromRequester` (`domain/approval.ts`) throws BEFORE
 * either database write is attempted, for BOTH `APPROVED` and `REJECTED`
 * outcomes (the check constraint this backstops applies to any non-null
 * `decidedByUserId`, regardless of decision). The
 * `approvals_decided_by_requester_check` CHECK constraint
 * (`20260905170100_risk_lifecycle_and_approvals_baseline`) is the SECOND,
 * independent layer — it holds even if this assertion is ever bypassed by a
 * future code path that forgets to call it.
 *
 * ## Re-evaluating the gate on every decision (ADR-006)
 *
 * The risk's status may have changed between the request and the decision
 * (e.g. through a direct, non-gated transition applied while the approval
 * sat pending — nothing in this release prevents that). `APPROVED`
 * therefore re-resolves `findLifecycleTransition(current.status, toStatus)`
 * and re-evaluates its preconditions against the CURRENT risk state, exactly
 * as `PerformTransitionUseCase` does for a direct transition — "the server
 * re-evaluates the same declarative transition table on every request"
 * (the contract's own words for `POST .../transitions`, extended here to
 * the decision endpoint). If the gate is no longer valid, this is refused
 * with 422 and the risk is left unchanged.
 *
 * ## `REJECTED` — FR-029c
 *
 * Clears `pendingApprovalId` only; `Risk.status` is untouched. No
 * `RiskLifecycleTransition` row is written for a rejection — nothing
 * transitioned. The decision itself is the permanent record (FR-029b),
 * captured entirely on the `Approval` row.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

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
import { assertApproverDiffersFromRequester } from '../../domain/approval';
import { ApprovalRepositoryPort } from '../../domain/ports/approval-repository.port';
import { RiskLifecycleTransitionRepositoryPort } from '../../domain/ports/risk-lifecycle-transition-repository.port';
import { RiskReferenceDataPort } from '../../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { findLifecycleTransition } from '../../domain/risk-lifecycle';
import { evaluatePreconditions } from '../../domain/transition-preconditions';

import type { ApprovalRecord } from '../../domain/ports/approval-repository.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';
import type { RiskStatus } from '@prisma/client';

const RISK_ENTITY_LABEL = 'Risco';
const APPROVAL_ENTITY_LABEL = 'Aprovação';

export interface DecideApprovalInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly approvalId: string;
  /** From the `If-Match` header (ADR-013) — the RISK's expected `version`. */
  readonly expectedVersion: number;
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly justification?: string | null | undefined;
}

export interface DecideApprovalResult {
  readonly approval: ApprovalRecord;
  readonly risk: RiskRecord;
}

/** `Approval.requestedTransition` is always written by
 * `RequestApprovalUseCase` as `${fromStatus}->${toStatus}` — parsing it
 * back is safe because this module is the only writer of that format. */
function parseRequestedTransitionTarget(requestedTransition: string): RiskStatus {
  const [, toStatus] = requestedTransition.split('->');
  return toStatus as RiskStatus;
}

@Injectable()
export class DecideApprovalUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly approvalRepository: ApprovalRepositoryPort,
    private readonly transitionRepository: RiskLifecycleTransitionRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: DecideApprovalInput): Promise<DecideApprovalResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.riskRepository.findById(scope, input.riskId);
    if (!current) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    const approval = await this.approvalRepository.findById(input.approvalId);
    if (approval?.entityType !== 'RISK' || approval.entityId !== input.riskId) {
      throw new NotFoundDomainError(APPROVAL_ENTITY_LABEL, input.approvalId);
    }

    if (approval.status !== 'PENDING') {
      throw new ConflictDomainError(USER_MESSAGES.risk.lifecycle.approvalAlreadyDecided);
    }

    // FR-029a — checked BEFORE either write, for both outcomes.
    assertApproverDiffersFromRequester(approval.requestedBy.id, input.actorUserId);

    const toStatus = parseRequestedTransitionTarget(approval.requestedTransition);
    const rule = findLifecycleTransition(current.status, toStatus);
    if (!rule?.requiresApproval) {
      throw new ValidationDomainError(
        USER_MESSAGES.risk.lifecycle.approvalTransitionNoLongerValid,
        [
          {
            field: 'decision',
            message: USER_MESSAGES.risk.lifecycle.approvalTransitionNoLongerValid,
          },
        ],
      );
    }

    const justification = input.justification ?? null;

    if (input.decision === 'REJECTED') {
      return this.transactionRunner.run(async () => {
        const decided = await this.approvalRepository.decide({
          id: input.approvalId,
          decidedByUserId: input.actorUserId,
          status: 'REJECTED',
          justification,
        });

        const result = await this.riskRepository.applyLifecycleTransition(
          scope,
          input.riskId,
          input.expectedVersion,
          { pendingApprovalId: null },
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
          action: 'risk.approval_rejected',
          entityType: AuditEntityType.APPROVAL,
          entityId: decided.id,
          actorLabel: actor.fullName,
          newValues: { riskId: input.riskId, decision: 'REJECTED', justification },
          organizationalUnitId: result.record.orgUnit.id,
        });

        return { approval: decided, risk: result.record };
      });
    }

    // APPROVED — re-check preconditions against the CURRENT risk state
    // (see this file's header for why).
    const preconditionResults = evaluatePreconditions(rule.preconditions, {
      risk: current,
      reassessedDuringReview: false,
    });
    const unmet = preconditionResults.filter((result) => !result.met);
    if (unmet.length > 0) {
      throw new ValidationDomainError(
        unmet[0]!.message,
        unmet.map((result) => ({ field: 'decision', message: result.message })),
      );
    }

    return this.transactionRunner.run(async () => {
      const decided = await this.approvalRepository.decide({
        id: input.approvalId,
        decidedByUserId: input.actorUserId,
        status: 'APPROVED',
        justification,
      });

      const transition = await this.transitionRepository.create({
        riskId: input.riskId,
        fromStatus: current.status,
        toStatus,
        performedByUserId: input.actorUserId,
        justification,
        approvalId: decided.id,
      });

      const result = await this.riskRepository.applyLifecycleTransition(
        scope,
        input.riskId,
        input.expectedVersion,
        { status: toStatus, pendingApprovalId: null },
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
        action: 'risk.approval_approved',
        entityType: AuditEntityType.APPROVAL,
        entityId: decided.id,
        actorLabel: actor.fullName,
        newValues: { riskId: input.riskId, decision: 'APPROVED', toStatus, justification },
        organizationalUnitId: result.record.orgUnit.id,
      });

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
          approvalId: decided.id,
        },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return { approval: decided, risk: result.record };
    });
  }
}
