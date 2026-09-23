import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerIndicatorAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.INDICATOR, [
    'code',
    'metricKey',
    'name',
    'description',
    'ownerUserId',
    'thresholdComparator',
    'thresholdValue',
    'isActive',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.INDICATOR_MEASUREMENT, [
    'metricKey',
    'value',
    'valueByBucket',
    'breached',
    'computedByUserId',
  ]);
}

export function __resetIndicatorAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
