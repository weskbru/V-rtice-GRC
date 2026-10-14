import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerAssetAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.ASSET, [
    'code',
    'name',
    'description',
    'orgUnitId',
    'isActive',
  ]);
}

export function __resetAssetAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
