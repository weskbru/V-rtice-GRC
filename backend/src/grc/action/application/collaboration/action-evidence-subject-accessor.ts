import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { GetActionUseCase } from '../get-action.usecase';

import type {
  EvidenceSubjectAccess,
  EvidenceSubjectAccessor,
} from '../../../shared/domain/ports/evidence-subject-resolver.port';

@Injectable()
export class ActionEvidenceSubjectAccessor implements EvidenceSubjectAccessor {
  constructor(
    private readonly getActionUseCase: GetActionUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableSubject(
    actorUserId: string,
    subjectId: string,
  ): Promise<EvidenceSubjectAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'action:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, subjectId);
    }

    const action = await this.getActionUseCase.execute({ actorUserId, actionId: subjectId });

    return {
      organizationalUnitId: action.orgUnit.id,
      label: `${action.code} — ${action.title}`,
    };
  }
}
