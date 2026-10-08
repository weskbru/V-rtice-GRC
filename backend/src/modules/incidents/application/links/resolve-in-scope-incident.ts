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
