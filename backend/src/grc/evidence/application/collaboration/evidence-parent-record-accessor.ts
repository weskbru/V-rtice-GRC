import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { GetEvidenceUseCase } from '../get-evidence.usecase';

import type {
  ParentRecordAccess,
  ParentRecordAccessor,
} from '../../../../core/comments/domain/entity-registry';

@Injectable()
export class EvidenceParentRecordAccessor implements ParentRecordAccessor {
  constructor(
    private readonly getEvidenceUseCase: GetEvidenceUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'evidence:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.evidence.entityLabel, entityId);
    }

    const evidence = await this.getEvidenceUseCase.execute({ actorUserId, evidenceId: entityId });

    return { organizationalUnitId: evidence.orgUnit.id };
  }
}
