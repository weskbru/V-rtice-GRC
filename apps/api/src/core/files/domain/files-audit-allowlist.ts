import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../audit/domain/audit-field-allowlist';

let registered = false;

export function registerFilesAuditAllowlist(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.ATTACHMENT, [
    'entityType',
    'entityId',
    'fileName',
    'contentType',
    'sizeBytes',
    'checksumSha256',
    'deletedAt',
    'deletedByUserId',
  ]);
}
