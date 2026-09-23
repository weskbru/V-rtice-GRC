import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerControlAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.CONTROL, [
    'name',
    'description',
    'orgUnitId',
    'ownerUserId',
    'nature',
    'type',
    'frequency',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.CONTROL_LIFECYCLE_TRANSITION, [
    'controlId',
    'fromStatus',
    'toStatus',
    'justification',
  ]);
}

export function __resetControlAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
