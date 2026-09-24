import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ProblemLookupPort } from '../domain/ports/problem-lookup.port';

import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../grc/shared/domain/ports/action-origin-resolver.port';
import type { UnitScopeFilter } from '../../../shared/persistence/scope-filter';

@Injectable()
export class ProblemActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly problemLookup: ProblemLookupPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'problem:edit');
  }

  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'problem:view');
  }

  async resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveScopedLookup(actorUserId, originId);
  }

  async listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.problemLookup.listIdsInScope(scope);
  }

  private async resolve(
    actorUserId: string,
    originId: string,
    requiredPermission: 'problem:edit' | 'problem:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, originId);
    }
    return this.resolveScopedLookup(actorUserId, originId);
  }

  private async resolveScopedLookup(
    actorUserId: string,
    originId: string,
  ): Promise<ActionOriginAccess> {
    const scope = await this.scopeResolver.resolveScope(actorUserId);
    const problem = await this.problemLookup.findScoped(scope, originId);
    if (!problem) {
      throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, originId);
    }

    return {
      organizationalUnitId: problem.orgUnitId,
      label: `${problem.code} — ${problem.title}`,
    };
  }
}
