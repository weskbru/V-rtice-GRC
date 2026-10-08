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
