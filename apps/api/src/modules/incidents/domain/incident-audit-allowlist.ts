import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerIncidentAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.INCIDENT, [
    'code',
    'title',
    'description',
    'severity',
    'orgUnitId',
    'ownerUserId',
    'reportedByUserId',
    'reportedOn',
    'status',
    'resolutionSummary',
    'resolvedAt',
    'resolvedByUserId',
    'closedAt',
    'closedByUserId',
    'cancellationReason',
    'cancelledAt',
    'cancelledByUserId',
    'reopenReason',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.INCIDENT_RISK_LINK, [
    'incidentId',
    'riskId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.INCIDENT_ASSET_LINK, [
    'incidentId',
    'assetId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.INCIDENT_PROCESS_LINK, [
    'incidentId',
    'processId',
    'unlinkedAt',
  ]);
}

export function __resetIncidentAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
