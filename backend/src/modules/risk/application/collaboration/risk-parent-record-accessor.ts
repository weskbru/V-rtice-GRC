import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { GetRiskUseCase } from '../get-risk.usecase';

import type {
  ParentRecordAccess,
  ParentRecordAccessor,
} from '../../../../core/comments/domain/entity-registry';

const RISK_ENTITY_LABEL = 'Risco';

@Injectable()
export class RiskParentRecordAccessor implements ParentRecordAccessor {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'risk:view');
    if (!canView) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, entityId);
    }

    const risk = await this.getRiskUseCase.execute({ actorUserId, riskId: entityId });

    return { organizationalUnitId: risk.orgUnit.id };
  }
}
