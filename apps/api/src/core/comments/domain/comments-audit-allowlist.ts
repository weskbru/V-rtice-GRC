import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../audit/domain/audit-field-allowlist';

let registered = false;

export function registerCommentsAuditAllowlist(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.COMMENT, [
    'entityType',
    'entityId',
    'body',
    'deletedAt',
    'deletedByUserId',
  ]);
}
