import { Injectable } from '@nestjs/common';

import { ApprovalRepositoryPort } from '../domain/ports/approval-repository.port';
import {
  RiskAssetLinkRepositoryPort,
  RiskControlLinkRepositoryPort,
  RiskProcessLinkRepositoryPort,
} from '../domain/ports/risk-relationship-repository.port';
import { RiskTreatmentActionQueryPort } from '../domain/ports/risk-treatment-action-query.port';
import { RiskTreatmentActionRepositoryPort } from '../domain/ports/risk-treatment-action-repository.port';
import { RiskTreatmentDecisionRepositoryPort } from '../domain/ports/risk-treatment-decision-repository.port';

import { GetRiskUseCase } from './get-risk.usecase';

import type { GetRiskInput } from './get-risk.usecase';
import type { ApprovalRecord } from '../domain/ports/approval-repository.port';
import type {
  ControlLinkRecord,
  EntityLinkRecord,
} from '../domain/ports/risk-relationship-repository.port';
import type { RiskRecord } from '../domain/ports/risk-repository.port';
import type { TreatmentActionSummary } from '../domain/ports/risk-treatment-action-query.port';
import type { TreatmentDecisionRecord } from '../domain/ports/risk-treatment-decision-repository.port';

export interface RiskDetailAggregate {
  readonly risk: RiskRecord;
  readonly currentTreatment: TreatmentDecisionRecord | undefined;
  readonly currentTreatmentHasOutstandingActions: boolean;
  readonly controls: readonly ControlLinkRecord[];
  readonly processes: readonly EntityLinkRecord[];
  readonly assets: readonly EntityLinkRecord[];
  readonly treatmentActionSummary: TreatmentActionSummary;
  readonly pendingApprovalDetail: ApprovalRecord | undefined;
}

@Injectable()
export class GetRiskDetailUseCase {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly treatmentActionRepository: RiskTreatmentActionRepositoryPort,
    private readonly treatmentActionQuery: RiskTreatmentActionQueryPort,
    private readonly controlLinkRepository: RiskControlLinkRepositoryPort,
    private readonly processLinkRepository: RiskProcessLinkRepositoryPort,
    private readonly assetLinkRepository: RiskAssetLinkRepositoryPort,
    private readonly approvalRepository: ApprovalRepositoryPort,
  ) {}

  async execute(input: GetRiskInput): Promise<RiskDetailAggregate> {
    const risk = await this.getRiskUseCase.execute(input);

    const [
      currentTreatment,
      controls,
      processes,
      assets,
      treatmentActionSummary,
      pendingApprovalDetail,
    ] = await Promise.all([
      this.treatmentDecisionRepository.findCurrentByRisk(risk.id),
      this.controlLinkRepository.listByRisk(risk.id, false),
      this.processLinkRepository.listByRisk(risk.id),
      this.assetLinkRepository.listByRisk(risk.id),
      this.treatmentActionQuery.summaryByRisk(risk.id),
      risk.pendingApprovalId !== undefined
        ? this.approvalRepository.findById(risk.pendingApprovalId)
        : Promise.resolve(undefined),
    ]);

    const currentTreatmentHasOutstandingActions = currentTreatment
      ? (
          await this.treatmentActionRepository.findDecisionIdsWithOutstandingActions([
            currentTreatment.id,
          ])
        ).has(currentTreatment.id)
      : false;

    return {
      risk,
      currentTreatment,
      currentTreatmentHasOutstandingActions,
      controls,
      processes,
      assets,
      treatmentActionSummary,
      pendingApprovalDetail,
    };
  }
}
