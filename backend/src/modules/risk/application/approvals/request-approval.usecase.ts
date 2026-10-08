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
  readonly expectedVersion: number;
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
