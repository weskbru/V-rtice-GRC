import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerProblemAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.PROBLEM, [
    'code',
    'title',
    'description',
    'severity',
    'orgUnitId',
    'ownerUserId',
    'status',
    'rootCause',
    'cancellationReason',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.PROBLEM_RISK_LINK, [
    'problemId',
    'riskId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.PROBLEM_INCIDENT_LINK, [
    'problemId',
    'incidentId',
    'unlinkedAt',
  ]);
}

export function __resetProblemAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
