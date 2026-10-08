import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { IndicatorDefinitionRepositoryPort } from '../../domain/ports/indicator-definition-repository.port';

import type {
  ParentRecordAccess,
  ParentRecordAccessor,
} from '../../../../core/comments/domain/entity-registry';

@Injectable()
export class IndicatorParentRecordAccessor implements ParentRecordAccessor {
  constructor(
    private readonly indicatorDefinitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'indicator:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, entityId);
    }

    const definition = await this.indicatorDefinitionRepository.findById(entityId);
    if (!definition) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, entityId);
    }

    return { organizationalUnitId: undefined };
  }
}
