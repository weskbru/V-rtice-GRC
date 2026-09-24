import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { GetIncidentUseCase } from '../get-incident.usecase';

import type {
  ParentRecordAccess,
  ParentRecordAccessor,
} from '../../../../core/comments/domain/entity-registry';

@Injectable()
export class IncidentParentRecordAccessor implements ParentRecordAccessor {
  constructor(
    private readonly getIncidentUseCase: GetIncidentUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'incident:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.incidents.entityLabel, entityId);
    }

    const incident = await this.getIncidentUseCase.execute({ actorUserId, incidentId: entityId });

    return { organizationalUnitId: incident.orgUnit.id };
  }
}
