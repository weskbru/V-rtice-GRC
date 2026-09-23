import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from './audit-field-allowlist';

let registered = false;

export function registerCoreEntityAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.USER, [
    'email',
    'fullName',
    'jobTitle',
    'status',
    'primaryOrgUnitId',
    'lastLoginAt',
    'reason',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.LOCAL_CREDENTIAL, [
    'passwordChangedAt',
    'mustChangePassword',
    'failedAttempts',
    'lockedUntil',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.EXTERNAL_IDENTITY, [
    'method',
    'externalSubject',
    'lastSyncedAt',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.SESSION, [
    'authenticationMethod',
    'expiresAt',
    'lastActivityAt',
    'ipAddress',
    'userAgent',
    'revokedAt',
    'revokedReason',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.PERMISSION, [
    'identifier',
    'resource',
    'action',
    'description',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.ROLE, ['name', 'description', 'isSystem']);

  registerAuditFieldAllowlist(AuditEntityType.ROLE_PERMISSION, ['roleId', 'permissionId']);

  registerAuditFieldAllowlist(AuditEntityType.USER_ROLE, [
    'userId',
    'roleId',
    'grantedByUserId',
    'grantedAt',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.ORGANIZATIONAL_UNIT, [
    'code',
    'name',
    'parentId',
    'path',
    'depth',
    'status',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.ORG_SCOPE_GRANT, [
    'scopeType',
    'orgUnitId',
    'grantedByUserId',
    'grantedAt',
  ]);
}
