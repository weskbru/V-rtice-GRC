import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { GetProblemUseCase } from '../get-problem.usecase';

import type {
  ParentRecordAccess,
  ParentRecordAccessor,
} from '../../../../core/comments/domain/entity-registry';

@Injectable()
export class ProblemParentRecordAccessor implements ParentRecordAccessor {
  constructor(
    private readonly getProblemUseCase: GetProblemUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'problem:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, entityId);
    }

    const problem = await this.getProblemUseCase.execute({ actorUserId, problemId: entityId });

    return { organizationalUnitId: problem.orgUnit.id };
  }
}
