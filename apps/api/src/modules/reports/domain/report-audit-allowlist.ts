import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerReportAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.REPORT, [
    'code',
    'name',
    'description',
    'metricKeys',
    'isActive',
  ]);
}

export function __resetReportAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
