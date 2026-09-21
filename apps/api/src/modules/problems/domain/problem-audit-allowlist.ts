/**
 * 008-incidents-problems, foundation — registers the
 * `AuditEntityType.PROBLEM` field allow-list, mirroring
 * `modules/incidents/domain/incident-audit-allowlist.ts` exactly — see
 * that file's header for the reasoning this one deliberately does not
 * repeat.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process. */
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

  // Also registers the two link-table entity types this module OWNS the
  // write side of: `PROBLEM_RISK_LINK` and — by decision of the
  // coordinator (research.md D-14) — `PROBLEM_INCIDENT_LINK`, same
  // `[originId, targetId, 'unlinkedAt']` shape every other link table uses.
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

/** Test-only escape hatch — never called by application code. */
export function __resetProblemAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
