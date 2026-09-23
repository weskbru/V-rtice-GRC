import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../grc/shared/domain/org-scope';
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { IncidentDirectoryPort } from '../../../shared/grc-ports/incident-directory.port';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type {
  EvidenceSubjectAccess,
  EvidenceSubjectAccessor,
} from '../../../grc/shared/domain/ports/evidence-subject-resolver.port';

@Injectable()
export class IncidentEvidenceSubjectAccessor implements EvidenceSubjectAccessor {
  constructor(
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async resolveViewableSubject(
    actorUserId: string,
    subjectId: string,
  ): Promise<EvidenceSubjectAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'incident:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.incidents.entityLabel, subjectId);
    }

    const incident = await this.incidentDirectory.findById(subjectId);
    if (!incident) {
      throw new NotFoundDomainError(USER_MESSAGES.incidents.entityLabel, subjectId);
    }

    const scope = await this.scopeResolver.resolveScope(actorUserId);
    if (!isOrgUnitWithinScope(scope, incident.orgUnitId)) {
      throw new NotFoundDomainError(USER_MESSAGES.incidents.entityLabel, subjectId);
    }

    return {
      organizationalUnitId: incident.orgUnitId,
      label: `${incident.code} — ${incident.title}`,
    };
  }
}
