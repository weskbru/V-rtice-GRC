import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ProblemLookupPort } from '../domain/ports/problem-lookup.port';

import type {
  EvidenceSubjectAccess,
  EvidenceSubjectAccessor,
} from '../../../grc/shared/domain/ports/evidence-subject-resolver.port';

@Injectable()
export class ProblemEvidenceSubjectAccessor implements EvidenceSubjectAccessor {
  constructor(
    private readonly problemLookup: ProblemLookupPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async resolveViewableSubject(
    actorUserId: string,
    subjectId: string,
  ): Promise<EvidenceSubjectAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'problem:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, subjectId);
    }

    const scope = await this.scopeResolver.resolveScope(actorUserId);
    const problem = await this.problemLookup.findScoped(scope, subjectId);
    if (!problem) {
      throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, subjectId);
    }

    return {
      organizationalUnitId: problem.orgUnitId,
      label: `${problem.code} — ${problem.title}`,
    };
  }
}
