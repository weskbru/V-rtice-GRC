import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerGrcAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.EVIDENCE, [
    'orgUnitId',
    'title',
    'description',
    'type',
    'source',
    'ownerUserId',
    'collectedOn',
    'validUntil',
    'fileId',
    'externalUrl',
    'observation',
    'status',
    'archivedAt',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.EVIDENCE_LINK, [
    'evidenceId',
    'subjectType',
    'subjectId',
    'note',
    'unlinkedAt',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.ACTION, [
    'originType',
    'originId',
    'title',
    'description',
    'responsibleUserId',
    'dueOn',
    'status',
    'completedAt',
    'reopenedAt',
    'reopenReason',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.FINDING, [
    'orgUnitId',
    'title',
    'description',
    'recommendation',
    'category',
    'origin',
    'severity',
    'priority',
    'ownerUserId',
    'identifiedOn',
    'status',
    'closedAt',
    'closureJustification',
    'reopenReason',
    'archivedAt',
    'auditEngagementId',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.FINDING_CONTROL_LINK, [
    'findingId',
    'controlId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.FINDING_RISK_LINK, [
    'findingId',
    'riskId',
    'unlinkedAt',
  ]);
}
