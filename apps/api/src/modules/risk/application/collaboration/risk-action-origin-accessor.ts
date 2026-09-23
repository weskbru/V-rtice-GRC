import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { GetRiskUseCase } from '../get-risk.usecase';

import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../../grc/shared/domain/ports/action-origin-resolver.port';
import type { UnitScopeFilter } from '../../../../shared/persistence/scope-filter';

const RISK_ENTITY_LABEL = 'Risco';

@Injectable()
export class RiskActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly permissionResolver: PermissionResolverService,
    private readonly riskRepository: RiskRepositoryPort,
  ) {}

  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveRisk(actorUserId, originId, 'risk:treat');
  }

  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveRisk(actorUserId, originId, 'risk:view');
  }

  async resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    const risk = await this.getRiskUseCase.execute({ actorUserId, riskId: originId });
    return {
      organizationalUnitId: risk.orgUnit.id,
      label: USER_MESSAGES.risk.evidenceSubject.riskLabel(risk.code, risk.title),
    };
  }

  async listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.riskRepository.listIdsInScope(scope);
  }

  private async resolveRisk(
    actorUserId: string,
    riskId: string,
    requiredPermission: 'risk:treat' | 'risk:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, riskId);
    }

    const risk = await this.getRiskUseCase.execute({ actorUserId, riskId });

    return {
      organizationalUnitId: risk.orgUnit.id,
      label: USER_MESSAGES.risk.evidenceSubject.riskLabel(risk.code, risk.title),
    };
  }
}
