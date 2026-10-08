import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerProcessAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.PROCESS, [
    'code',
    'name',
    'description',
    'orgUnitId',
    'isActive',
  ]);
}

export function __resetProcessAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
