import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { RiskTreatmentDecisionRepositoryPort } from '../../domain/ports/risk-treatment-decision-repository.port';
import { GetRiskUseCase } from '../get-risk.usecase';

import type {
  EvidenceSubjectAccess,
  EvidenceSubjectAccessor,
} from '../../../../grc/shared/domain/ports/evidence-subject-resolver.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';
const RISK_TREATMENT_DECISION_LABEL = 'Decisão de tratamento de risco';

@Injectable()
export class RiskEvidenceSubjectAccessor implements EvidenceSubjectAccessor {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableSubject(
    actorUserId: string,
    subjectId: string,
  ): Promise<EvidenceSubjectAccess> {
    const risk = await this.resolveViewableRisk(actorUserId, subjectId);
    return {
      organizationalUnitId: risk.orgUnit.id,
      label: USER_MESSAGES.risk.evidenceSubject.riskLabel(risk.code, risk.title),
    };
  }

  async resolveViewableRisk(actorUserId: string, riskId: string): Promise<RiskRecord> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'risk:view');
    if (!canView) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, riskId);
    }
    return this.getRiskUseCase.execute({ actorUserId, riskId });
  }
}

@Injectable()
export class RiskTreatmentDecisionEvidenceSubjectAccessor implements EvidenceSubjectAccessor {
  constructor(
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly riskAccessor: RiskEvidenceSubjectAccessor,
  ) {}

  async resolveViewableSubject(
    actorUserId: string,
    subjectId: string,
  ): Promise<EvidenceSubjectAccess> {
    const decision = await this.treatmentDecisionRepository.findById(subjectId);
    if (!decision) {
      throw new NotFoundDomainError(RISK_TREATMENT_DECISION_LABEL, subjectId);
    }

    try {
      const risk = await this.riskAccessor.resolveViewableRisk(actorUserId, decision.riskId);

      return {
        organizationalUnitId: risk.orgUnit.id,
        label: USER_MESSAGES.risk.evidenceSubject.treatmentDecisionLabel(
          risk.code,
          USER_MESSAGES.risk.history.treatmentStrategyLabels[decision.strategy],
        ),
      };
    } catch (error) {
      if (error instanceof NotFoundDomainError) {
        throw new NotFoundDomainError(RISK_TREATMENT_DECISION_LABEL, subjectId);
      }
      throw error;
    }
  }
}
