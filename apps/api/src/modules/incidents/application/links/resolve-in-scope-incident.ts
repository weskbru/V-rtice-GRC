/**
 * 008-incidents-problems, US3 — the SOURCE-side existence+scope check
 * shared by all three `Incident -> {Risk,Asset,Process}` link use cases
 * (`link-incident-risk.usecase.ts`, `link-incident-asset.usecase.ts`,
 * `link-incident-process.usecase.ts`) and the read-only
 * `list-incident-problem-links.usecase.ts`.
 *
 * `modules/incidents` has no full `IncidentRepositoryPort` yet (the
 * incident lifecycle is a concurrent, separate workstream — data-model.md
 * §1), so this goes through `IncidentDirectoryPort.findById` instead of a
 * scoped repository lookup — the exact read
 * `IncidentActionOriginAccessor.resolveScopedLookup`
 * (`application/incident-action-origin-accessor.ts`) already performs for
 * the identical reason. `IncidentDirectoryPort.findById` is inherently
 * UNSCOPED (it returns the entry regardless of the caller's scope), so the
 * already-fetched entry doubles as the "resolve actual org unit" callback
 * `OrgScopeEnforcerService.assertExistingRecordAccessible` (F-38) needs,
 * with no second round-trip and no separate unscoped lookup method
 * required.
 */
import { AuditEntityType } from '@prisma/client';

import { isOrgUnitWithinScope } from '../../../../grc/shared/domain/org-scope';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { OrgScopeEnforcerService } from '../../../../core/organizations/application/org-scope-enforcer.service';
import type {
  IncidentDirectoryEntry,
  IncidentDirectoryPort,
} from '../../../../shared/grc-ports/incident-directory.port';
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';

export async function resolveInScopeIncident(
  incidentDirectory: IncidentDirectoryPort,
  scopeEnforcer: OrgScopeEnforcerService,
  scope: ScopeFilter,
  actorUserId: string,
  incidentId: string,
): Promise<IncidentDirectoryEntry> {
  const entry = await incidentDirectory.findById(incidentId);
  const inScope = entry ? isOrgUnitWithinScope(scope, entry.orgUnitId) : false;
  if (entry && inScope) {
    return entry;
  }

  return scopeEnforcer.assertExistingRecordAccessible(
    {
      scope,
      actorUserId,
      entityType: AuditEntityType.INCIDENT,
      entityId: incidentId,
      entityLabel: USER_MESSAGES.incidents.entityLabel,
    },
    () => Promise.resolve(entry?.orgUnitId),
  );
}
