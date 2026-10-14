import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerAuditEngagementAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.AUDIT_ENGAGEMENT, [
    'objective',
    'periodStart',
    'periodEnd',
    'orgUnitId',
    'leadAuditorUserId',
    'status',
    'startedAt',
    'startedByUserId',
    'completedAt',
    'completedByUserId',
    'cancelledAt',
    'cancelledByUserId',
    'cancellationJustification',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.AUDIT_SCOPE_FRAMEWORK_VERSION, [
    'auditEngagementId',
    'frameworkVersionId',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.AUDIT_SCOPE_REQUIREMENT, [
    'auditEngagementId',
    'requirementId',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.AUDIT_SCOPE_CONTROL, [
    'auditEngagementId',
    'controlId',
  ]);
}

export function __resetAuditEngagementAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
