import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { CreateActionUseCase } from '../../../../grc/action/application/create-action.usecase';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { RiskReferenceDataPort } from '../../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { RiskTreatmentActionRepositoryPort } from '../../domain/ports/risk-treatment-action-repository.port';
import { RiskTreatmentDecisionRepositoryPort } from '../../domain/ports/risk-treatment-decision-repository.port';
import { assertBusinessContentEditable } from '../../domain/risk.entity';

import type { ActionRecord } from '../../../../grc/action/domain/ports/action-repository.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';

export interface CreateTreatmentActionInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly expectedVersion: number;
  readonly title: string;
  readonly description?: string | null | undefined;
  readonly responsibleUserId: string;
  readonly dueOn: string;
  readonly treatmentDecisionId?: string | null | undefined;
}

export interface CreateTreatmentActionResult {
  readonly action: ActionRecord;
  readonly treatmentDecisionId: string | null;
  readonly risk: RiskRecord;
}

@Injectable()
export class CreateTreatmentActionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly treatmentActionRepository: RiskTreatmentActionRepositoryPort,
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly createActionUseCase: CreateActionUseCase,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: CreateTreatmentActionInput): Promise<CreateTreatmentActionResult> {
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

    assertBusinessContentEditable(current.status);

    const responsible = await this.referenceData.findUser(input.responsibleUserId);
    if (!responsible?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.risk.responsibleNotFound, [
        { field: 'responsibleUserId', message: USER_MESSAGES.risk.responsibleNotFound },
      ]);
    }

    const treatmentDecisionId = input.treatmentDecisionId ?? null;
    if (treatmentDecisionId) {
      const decision = await this.treatmentDecisionRepository.findById(treatmentDecisionId);
      if (decision?.riskId !== input.riskId) {
        throw new ValidationDomainError(USER_MESSAGES.risk.treatment.decisionNotFound, [
          { field: 'treatmentDecisionId', message: USER_MESSAGES.risk.treatment.decisionNotFound },
        ]);
      }
    }

    const description = input.description ?? null;

    return this.transactionRunner.run(async () => {
      const { record: sharedAction } = await this.createActionUseCase.execute({
        actorUserId: input.actorUserId,
        originType: 'RISK_TREATMENT',
        originId: input.riskId,
        title: input.title,
        description: description ?? undefined,
        responsibleUserId: input.responsibleUserId,
        dueOn: input.dueOn,
      });

      const link = await this.treatmentActionRepository.createLink({
        riskId: input.riskId,
        treatmentDecisionId,
        actionId: sharedAction.id,
      });

      const result = await this.riskRepository.touchVersion(
        scope,
        input.riskId,
        input.expectedVersion,
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
        action: 'risk.treatment_action_created',
        entityType: AuditEntityType.RISK_TREATMENT_ACTION,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: {
          riskId: input.riskId,
          treatmentDecisionId,
          actionId: sharedAction.id,
        },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return { action: sharedAction, treatmentDecisionId, risk: result.record };
    });
  }
}
