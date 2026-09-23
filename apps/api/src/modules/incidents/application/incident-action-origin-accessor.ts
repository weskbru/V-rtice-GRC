import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../grc/shared/domain/org-scope';
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { IncidentDirectoryPort } from '../../../shared/grc-ports/incident-directory.port';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../grc/shared/domain/ports/action-origin-resolver.port';
import type { UnitScopeFilter } from '../../../shared/persistence/scope-filter';

@Injectable()
export class IncidentActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'incident:edit');
  }

  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'incident:view');
  }

  async resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveScopedLookup(actorUserId, originId);
  }

  async listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.incidentDirectory.listIdsInScope(scope);
  }

  private async resolve(
    actorUserId: string,
    originId: string,
    requiredPermission: 'incident:edit' | 'incident:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(USER_MESSAGES.incidents.entityLabel, originId);
    }
    return this.resolveScopedLookup(actorUserId, originId);
  }

  private async resolveScopedLookup(
    actorUserId: string,
    originId: string,
  ): Promise<ActionOriginAccess> {
    const incident = await this.incidentDirectory.findById(originId);
    if (!incident) {
      throw new NotFoundDomainError(USER_MESSAGES.incidents.entityLabel, originId);
    }

    const scope = await this.scopeResolver.resolveScope(actorUserId);
    if (!isOrgUnitWithinScope(scope, incident.orgUnitId)) {
      throw new NotFoundDomainError(USER_MESSAGES.incidents.entityLabel, originId);
    }

    return {
      organizationalUnitId: incident.orgUnitId,
      label: `${incident.code} — ${incident.title}`,
    };
  }
}
