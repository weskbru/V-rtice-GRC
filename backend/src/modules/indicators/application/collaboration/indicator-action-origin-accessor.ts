import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError, ValidationDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { IndicatorDefinitionRepositoryPort } from '../../domain/ports/indicator-definition-repository.port';
import { IndicatorReferenceDataPort } from '../../domain/ports/indicator-reference-data.port';

import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../../grc/shared/domain/ports/action-origin-resolver.port';
import type { UnitScopeFilter } from '../../../../shared/persistence/scope-filter';

@Injectable()
export class IndicatorActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly indicatorDefinitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly indicatorReferenceData: IndicatorReferenceDataPort,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'indicator:edit');
  }

  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'indicator:view');
  }

  async resolveOriginScope(_actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveExisting(originId);
  }

  async listOriginIdsInScope(_scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.indicatorDefinitionRepository.listAllIds();
  }

  private async resolve(
    actorUserId: string,
    originId: string,
    requiredPermission: 'indicator:edit' | 'indicator:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, originId);
    }
    return this.resolveExisting(originId);
  }

  private async resolveExisting(originId: string): Promise<ActionOriginAccess> {
    const definition = await this.indicatorDefinitionRepository.findById(originId);
    if (!definition) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, originId);
    }

    const organizationalUnitId = await this.indicatorReferenceData.findUserOrgUnitId(
      definition.ownerUserId,
    );
    if (!organizationalUnitId) {
      throw new ValidationDomainError(USER_MESSAGES.indicators.ownerHasNoOrgUnitForAction);
    }

    return {
      organizationalUnitId,
      label: `${definition.code} — ${definition.name}`,
    };
  }
}
