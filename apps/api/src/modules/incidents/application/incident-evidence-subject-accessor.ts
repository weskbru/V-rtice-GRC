/**
 * 008-incidents-problems, foundation — `modules/incidents`'s own
 * registration against `EvidenceSubjectResolverPort`'s registry
 * (`grc/shared/domain/ports/evidence-subject-resolver.port.ts`) for
 * `EvidenceSubjectType.INCIDENT` (spec.md FR-017). Mirrors
 * `ControlEvidenceSubjectAccessor`'s shape: `incident:view` permission
 * PLUS a scope-checked read, neither substituting for the other.
 *
 * ## Depends on `IncidentDirectoryPort`, not a not-yet-built repository
 *
 * Every other module's own accessor delegates to that module's own
 * scope-checked `GetXUseCase`/`XAccessResolver`. Neither exists yet for
 * `Incident` (Fase 3, tasks.md's own scope) — this foundation pass builds
 * only the schema, permissions and module skeletons. `IncidentDirectoryPort`
 * (`shared/grc-ports/`, built this same pass for `modules/problems`'s own
 * future use, data-model.md §6) already exposes exactly the read this
 * accessor needs (`{ id, code, title, status, orgUnitId }`) — reusing it
 * here, rather than importing `PrismaService` directly, keeps this file a
 * `module-application` element depending only on `shared`/`core`
 * elements, never `module-infrastructure` (ADR-011,
 * `apps/api/eslint.config.mjs`'s `boundaries/dependencies`). This is a
 * real, correct, minimal implementation of the one method this port
 * requires — not a stub — so the registration
 * `test/unit/evidence-subject-registry-guard.spec.ts` enforces is genuine.
 * **Replace with `GetIncidentUseCase` once Fase 3 builds it.**
 */
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
