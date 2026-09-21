/**
 * Default allow-list registrations for the `AuditEntityType` values that
 * already exist in `schema.prisma` (Core — identity, sessions,
 * authorization, organizations). This is deliberately the FIRST caller of
 * `registerAuditFieldAllowlist`, not a special case of it: a future
 * business module (Risk Management, ...) registers its own entity types'
 * allow-lists exactly the same way, from its own module file, without
 * touching this one (T030, ADR-011).
 *
 * Every field name below is checked against `schema.prisma` field-by-field.
 * Deliberately excluded, with the reason:
 *   - `LocalCredential.passwordHash` — a password hash (FR-035/FR-108).
 *   - `Session.tokenHash` — a session token hash (FR-035/FR-108).
 *   - every `id` primary key — the entity id is already the audit row's
 *     `entityId` column; repeating it inside the JSONB payload is noise.
 *   - every FK that already has a first-class audit column
 *     (`actorUserId`, `organizationalUnitId` are populated by
 *     `AuditRecorder` itself, not copied from the entity payload).
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from './audit-field-allowlist';

let registered = false;

/**
 * Idempotent: safe to call more than once (e.g. if both `AuditModule` and
 * a test import path trigger it in the same process) — only the first
 * call has any effect, so a second call never hits
 * `registerAuditFieldAllowlist`'s "already registered" guard.
 */
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
    // T176/US8 — `SetUserStatusUseCase` (`PUT /admin/users/{userId}/status`).
    // NOT a `User` column: `admin.openapi.yaml`'s `SetUserStatusRequest`
    // carries an optional, operator-supplied `reason` "recorded in the
    // audit entry as operation context (FR-033)" that has no persisted
    // home on the entity itself — unlike every other field in this list,
    // which mirrors a real `schema.prisma` column. Admitted here,
    // deliberately and narrowly, because the contract explicitly requires
    // this context to reach the audit trail and there is no other
    // allow-listed field it could travel in. Still passes
    // `registerAuditFieldAllowlist`'s secret-shape rejection (it is not
    // shaped like a hash/token/secret/credential).
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
