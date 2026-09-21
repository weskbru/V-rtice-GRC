/**
 * T189/T190 — registers the `AuditEntityType.ATTACHMENT` field allow-list
 * (`core/audit/domain/audit-field-allowlist.ts`, FR-035, FR-100). Called
 * once, from `FilesModule`'s own constructor — the exact extension point
 * `core-entity-audit-allowlists.ts`/`risk-audit-allowlist.ts` already
 * describe and exercise. `core/audit/**` is never touched by this file
 * (ADR-011).
 *
 * One list covers both operations that ever audit an attachment: upload
 * (`UploadService`, every field IS the "new value") and withdrawal
 * (`WithdrawAttachmentUseCase`, where `deletedAt`/`deletedByUserId` are the
 * "new values") — "one list per entity type, not one per operation", the
 * same convention `risk-audit-allowlist.ts` documents for
 * `RISK_TREATMENT_ACTION`.
 *
 * Deliberately excluded, checked against `schema.prisma`'s `Attachment`
 * model field-by-field:
 *   - `id` — already the audit row's own `entityId`.
 *   - `uploadedByUserId` — already the audit row's own `actorUserId`.
 *   - `createdAt` — already the audit row's own `occurredAt`.
 *   - `storageKey` — an internal storage-layout detail (FR-107: "no
 *     internal identifier" leaks); auditing it would put exactly the
 *     opaque path ADR-010 requires never be disclosed into a JSONB payload
 *     any `audit:view` holder could read.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent, exactly like `registerCoreEntityAuditAllowlists`/
 * `registerRiskAuditAllowlists` — safe to call more than once in the same
 * process. */
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
