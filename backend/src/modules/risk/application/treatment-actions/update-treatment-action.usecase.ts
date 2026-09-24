import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { TransitionActionUseCase } from '../../../../grc/action/application/transition-action.usecase';
import { UpdateActionUseCase } from '../../../../grc/action/application/update-action.usecase';
import { ActionRepositoryPort } from '../../../../grc/action/domain/ports/action-repository.port';
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
import type { ActionStatus } from '@prisma/client';

const RISK_ENTITY_LABEL = 'Risco';

export interface UpdateTreatmentActionInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly actionId: string;
  readonly expectedVersion: number;
  readonly title?: string | undefined;
  readonly description?: string | null | undefined;
  readonly responsibleUserId?: string | undefined;
  readonly dueOn?: string | undefined;
  readonly status?: ActionStatus | undefined;
  readonly reopenReason?: string | undefined;
  readonly treatmentDecisionId?: string | null | undefined;
}

export interface UpdateTreatmentActionResult {
  readonly action: ActionRecord;
  readonly treatmentDecisionId: string | null;
  readonly risk: RiskRecord;
}

@Injectable()
export class UpdateTreatmentActionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly treatmentActionRepository: RiskTreatmentActionRepositoryPort,
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly actionRepository: ActionRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly updateActionUseCase: UpdateActionUseCase,
    private readonly transitionActionUseCase: TransitionActionUseCase,
  ) {}

  async execute(input: UpdateTreatmentActionInput): Promise<UpdateTreatmentActionResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const currentRisk = await this.riskRepository.findById(scope, input.riskId);
    if (!currentRisk) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    assertBusinessContentEditable(currentRisk.status);

    const existingAction = await this.actionRepository.findByIdUnscoped(input.actionId);
    if (
      existingAction?.originType !== 'RISK_TREATMENT' ||
      existingAction.originId !== input.riskId
    ) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
    }

    if (input.treatmentDecisionId) {
      const decision = await this.treatmentDecisionRepository.findById(input.treatmentDecisionId);
      if (decision?.riskId !== input.riskId) {
        throw new ValidationDomainError(USER_MESSAGES.risk.treatment.decisionNotFound, [
          { field: 'treatmentDecisionId', message: USER_MESSAGES.risk.treatment.decisionNotFound },
        ]);
      }
    }

    return this.transactionRunner.run(async () => {
      let updated: ActionRecord = existingAction;

      const fieldChanges = {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.responsibleUserId !== undefined
          ? { responsibleUserId: input.responsibleUserId }
          : {}),
        ...(input.dueOn !== undefined ? { dueOn: input.dueOn } : {}),
      };
      if (Object.keys(fieldChanges).length > 0) {
        updated = await this.updateActionUseCase.execute({
          actorUserId: input.actorUserId,
          actionId: input.actionId,
          ...fieldChanges,
        });
      }

      if (input.status !== undefined) {
        updated = await this.transitionActionUseCase.execute({
          actorUserId: input.actorUserId,
          actionId: input.actionId,
          to: input.status,
          reason: input.reopenReason,
        });
      }

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

      let link = await this.treatmentActionRepository.findLink(input.riskId, input.actionId);

      if (input.treatmentDecisionId !== undefined) {
        const previousTreatmentDecisionId = link?.treatmentDecisionId ?? null;
        link = await this.treatmentActionRepository.upsertTreatmentDecisionLink(
          input.riskId,
          input.actionId,
          input.treatmentDecisionId,
        );

        if (link.treatmentDecisionId !== previousTreatmentDecisionId) {
          await this.auditRecorder.record({
            action: 'risk.treatment_action_updated',
            entityType: AuditEntityType.RISK_TREATMENT_ACTION,
            entityId: link.id,
            actorLabel: actor.fullName,
            previousValues: { treatmentDecisionId: previousTreatmentDecisionId },
            newValues: {
              riskId: input.riskId,
              treatmentDecisionId: link.treatmentDecisionId,
              actionId: input.actionId,
            },
            organizationalUnitId: result.record.orgUnit.id,
          });
        }
      }

      return {
        action: updated,
        treatmentDecisionId: link?.treatmentDecisionId ?? null,
        risk: result.record,
      };
    });
  }
}
