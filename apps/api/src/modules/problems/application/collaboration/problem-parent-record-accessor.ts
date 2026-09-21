/**
 * 008-incidents-problems — `ProblemParentRecordAccessor`: `modules/
 * problems`'s registration against the attachable/commentable entity-type
 * registry (`core/comments/domain/entity-registry.ts`). Mirrors
 * `IncidentParentRecordAccessor`/`RiskParentRecordAccessor` exactly — see
 * `RiskParentRecordAccessor`'s own header for the full reasoning this one
 * deliberately does not repeat: `problem:view`, checked first, PLUS
 * `GetProblemUseCase`'s own organizational-scope check, combined into the
 * single non-disclosing refusal FR-098/FR-030 require.
 *
 * `AttachableEntityType.PROBLEM`/`CommentableEntityType.PROBLEM` were
 * added to `schema.prisma` in this module's own foundation migration —
 * the registry's own worked-example comment even names `PROBLEM`
 * specifically — but no accessor was ever registered for either
 * (CLAUDE.md §19.10). This is that missing registration, exercised by
 * `test/integration/incident-problem-collaboration.spec.ts`.
 */
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
