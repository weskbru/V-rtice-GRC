/**
 * T014/006-assets-processes — registers the `AuditEntityType.ASSET` field
 * allow-list (`core/audit/domain/audit-field-allowlist.ts`, data-model.md
 * §7). Follows `modules/controls/domain/control-audit-allowlist.ts`'s exact
 * convention — see that file's header for why this is a registry call, not
 * a hard-coded object literal in `core/audit/**` (ADR-011).
 *
 * ## One entity type, not two — unlike `Control`/`AuditEngagement`
 *
 * `Control` and `AuditEngagement` each split their own record from their
 * lifecycle transition into TWO `AuditEntityType` values
 * (`CONTROL`/`CONTROL_LIFECYCLE_TRANSITION`,
 * `AUDIT_ENGAGEMENT`/…) because each has a multi-state lifecycle whose
 * transition is a distinct business fact from a plain field edit. `Asset`
 * has no such lifecycle (research.md D-3): `isActive` is a two-state
 * situation with exactly two edges (deactivate/reactivate), and T001 adds
 * exactly one value, `ASSET` — matching `data-model.md §1`'s own migration
 * and §7's own table, which names a single `ASSET` type for all four
 * audited actions (`created`/`updated`/`deactivated`/`reactivated`).
 *
 * ## `code` IS included — a deliberate divergence from `Control`'s own
 * exclusion, not an oversight
 *
 * `control-audit-allowlist.ts` excludes `code` ("never changes after
 * creation and is already the audit row's own `entityId` context").
 * data-model.md §7 explicitly calls for the opposite here: `asset.created`
 * "regista valores novos, incluindo `orgUnitId` e `code` gerado" — the
 * server-assigned code is part of what a reader of the CREATION event needs
 * to see, since (unlike `Control`) there is no separate lookup already
 * showing it at that point in this fase (no `GET`/list endpoint exists yet
 * — Fase 3's own scope). `code` never appears in any OTHER audited action's
 * `previousValues`/`newValues` — it is immutable post-creation, exactly as
 * `Control`'s own is — so its presence here is additive, not a hazard: an
 * update/deactivate/reactivate event's diff never includes it because
 * `UpdateAssetUseCase`/the two transition use cases (Fase 3) never write to
 * it.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process (multiple
 * Nest testing modules within one test run), exactly like
 * `registerControlAuditAllowlists`. */
export function registerAssetAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  // `CreateAssetUseCase` audits `code`/`name`/`description`/`orgUnitId`
  // (creation, `asset.created`); `UpdateAssetUseCase` audits
  // `name`/`description`/`orgUnitId` (`asset.updated`, previous AND new
  // values); `DeactivateAssetUseCase`/`ReactivateAssetUseCase` each audit
  // `isActive` (`asset.deactivated`/`asset.reactivated`) — all four
  // actions share this ONE entity type (see this file's own header for
  // why), so the allow-list is the union of every field any of them ever
  // writes. None of the four use cases exists yet in this fase (Fase 3's
  // own scope) — this registration only needs to EXIST so
  // `AuditRecorder.record(...)` does not throw
  // `AuditFieldAllowlistNotRegisteredError` the moment one does.
  registerAuditFieldAllowlist(AuditEntityType.ASSET, [
    'code',
    'name',
    'description',
    'orgUnitId',
    'isActive',
  ]);
}

/** Test-only escape hatch, mirroring
 * `__resetControlAuditAllowlistRegistrationForTests`'s own convention —
 * never called by application code. */
export function __resetAssetAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
