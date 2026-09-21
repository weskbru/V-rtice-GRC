/**
 * 008-incidents-problems — `modules/incidents`'s own registration against
 * `ActionOriginResolverPort`'s registry
 * (`grc/shared/domain/ports/action-origin-resolver.port.ts`) for
 * `ActionOriginType.INCIDENT` (spec.md FR-016, research.md D-2). Mirrors
 * `ControlAssessmentActionOriginAccessor`'s shape exactly — see that
 * file's header for the full two-check rationale this file does not
 * repeat.
 *
 * `Action.originId` for `INCIDENT` is the `Incident`'s own id.
 * `resolveEditableOrigin` is checked against `incident:edit` — stricter
 * than `resolveViewableOrigin` (`incident:view`) — the same "edit vs.
 * view" split `ControlAssessmentActionOriginAccessor`/
 * `FindingActionOriginAccessor` already use, since Incidents has no
 * dedicated "treat"-shaped permission the way Risk does.
 *
 * ## The live-scope rule (coordinator, 2026-09-11)
 *
 * `resolveOriginScope`/`listOriginIdsInScope` (and, transitively,
 * `resolveEditableOrigin`/`resolveViewableOrigin`, which both delegate to
 * the same scoped lookup) re-derive the incident's CURRENT organizational
 * unit on every call — via `IncidentDirectoryPort.findById`/
 * `.listIdsInScope`, never from a value stamped on the `Action` at
 * creation time. This is the exact defect this codebase has already had
 * to fix three times on single-record routes and once more on a listing
 * (`grc/action`'s own assurance-fix history) — an `Incident` reassigned to
 * a different unit after an `Action` was created must be re-evaluated
 * against the actor's CURRENT scope, not the unit it belonged to when the
 * `Action` was made.
 */
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

  /** Registered for `ActionOriginType.INCIDENT` — `createAction`'s own
   * gate (FR-031). */
  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'incident:edit');
  }

  /** Registered for `ActionOriginType.INCIDENT` — the read-side
   * counterpart used only to populate `Action.originLabel`. */
  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'incident:view');
  }

  /** Registered for `ActionOriginType.INCIDENT` — the assurance-fix
   * SCOPE-ONLY re-check (no permission gate — see
   * `action-origin-resolver.port.ts#resolveOriginScope`'s own doc comment
   * for why). Re-derives the incident's LIVE unit on every call. */
  async resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveScopedLookup(actorUserId, originId);
  }

  /** Registered for `ActionOriginType.INCIDENT` — the bulk, SCOPE-ONLY
   * listing `ListActionUseCase` uses to filter a page of actions by their
   * origin incident's CURRENT unit, in one query. */
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
