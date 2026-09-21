/**
 * T014/006-assets-processes — registers the `AuditEntityType.PROCESS` field
 * allow-list. Identical in shape and reasoning to
 * `modules/assets/domain/asset-audit-allowlist.ts` (FR-020) — see that
 * file's header for the full account this one does not repeat, including
 * why `code` IS included (a deliberate divergence from `Control`'s own
 * exclusion) and why one entity type suffices (no lifecycle beyond
 * `isActive`, research.md D-3).
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process, exactly
 * like `registerAssetAuditAllowlists`. */
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

/** Test-only escape hatch, never called by application code. */
export function __resetProcessAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
