/**
 * T192 — registers the `AuditEntityType.COMMENT` field allow-list
 * (`core/audit/domain/audit-field-allowlist.ts`, FR-035, FR-100). Called
 * once, from `CommentsModule`'s own constructor — the exact extension
 * point `core-entity-audit-allowlists.ts` and `risk-audit-allowlist.ts`
 * (`RiskModule`) already describe and exercise. `core/audit/**` is never
 * touched by this file (ADR-011).
 *
 * Every field below is checked against `schema.prisma`'s `Comment` model,
 * field-by-field. Deliberately excluded, with the reason:
 *   - `id` — already the audit row's own `entityId`.
 *   - `authorUserId` — already the audit row's own `actorUserId`
 *     (`AuditRecorder` derives this from the ambient request context, not
 *     from the entity payload).
 *   - `createdAt` — already the audit row's own `occurredAt`.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent, exactly like `registerCoreEntityAuditAllowlists`/
 * `registerRiskAuditAllowlists` — safe to call more than once in the same
 * process. */
export function registerCommentsAuditAllowlist(): void {
  if (registered) {
    return;
  }
  registered = true;

  // One list covers both operations that ever audit a comment — creation
  // (`CreateCommentUseCase`, every field IS the "new value", no "previous
  // value" to diff against, same shape as `RISK_ASSESSMENT`'s own
  // allow-list in `risk-audit-allowlist.ts`) and withdrawal
  // (`WithdrawCommentUseCase`, where `deletedAt`/`deletedByUserId` are the
  // "new values") — "one list per entity type, not one per operation",
  // the same convention `risk-audit-allowlist.ts`'s own comment documents
  // for `RISK_TREATMENT_ACTION`.
  registerAuditFieldAllowlist(AuditEntityType.COMMENT, [
    'entityType',
    'entityId',
    'body',
    'deletedAt',
    'deletedByUserId',
  ]);
}
