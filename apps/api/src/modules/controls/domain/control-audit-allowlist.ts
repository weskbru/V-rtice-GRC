/**
 * T020/003-controls-management — registers the `AuditEntityType.CONTROL`
 * and `AuditEntityType.CONTROL_LIFECYCLE_TRANSITION` field allow-lists
 * (`core/audit/domain/audit-field-allowlist.ts`, FR-030). Follows
 * `modules/risk/domain/risk-audit-allowlist.ts`'s exact convention — see
 * that file's header for why this is a registry call, not a hard-coded
 * object literal in `core/audit/**` (ADR-011).
 *
 * ## Where this must be called from
 *
 * `RiskModule`/`EvidenceModule` each call their own
 * `register*AuditAllowlists()` once, from their own composition root's
 * constructor. This task does not own `controls.module.ts` (the
 * coordinator wires both Controls workstreams into it) — see this task's
 * report for the exact call the coordinator must add:
 * `registerControlAuditAllowlists()`, from `ControlsModule`'s constructor,
 * mirroring `RiskModule`'s own `registerRiskAuditAllowlists()` call
 * exactly. Until that call is wired in, `AuditRecorder.record(...)` for
 * either entity type throws `AuditFieldAllowlistNotRegisteredError` — by
 * design (the registry's own "missing registration is a programming
 * error, not user data to defensively drop" rule) — which is exactly what
 * makes a missed wiring loud instead of silent.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process (multiple
 * Nest testing modules within one test run), exactly like
 * `registerRiskAuditAllowlists`. */
export function registerControlAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  // `CreateControlUseCase`/`UpdateControlUseCase` audit the control's own
  // descriptive/ownership/classification fields — `code`/`status`/
  // `version`/`isActive`/`effectiveness` are deliberately excluded for the
  // same reasons `risk-audit-allowlist.ts` excludes their Risk
  // equivalents: `code` never changes after creation (FR-002) and is
  // already the audit row's own `entityId` context; `status`/`isActive`
  // are written exclusively by the lifecycle-transition path below, never
  // by a plain edit; `version` is the optimistic-lock counter, not
  // business content; `effectiveness` is derived and never written at all
  // (FR-012).
  registerAuditFieldAllowlist(AuditEntityType.CONTROL, [
    'name',
    'description',
    'orgUnitId',
    'ownerUserId',
    'nature',
    'type',
    'frequency',
  ]);

  // `PerformControlTransitionUseCase` audits the newly applied transition
  // itself (append-only — every field IS the "new value"), the same shape
  // `RISK_LIFECYCLE_TRANSITION`'s own allow-list documents.
  registerAuditFieldAllowlist(AuditEntityType.CONTROL_LIFECYCLE_TRANSITION, [
    'controlId',
    'fromStatus',
    'toStatus',
    'justification',
  ]);
}

/** Test-only escape hatch, mirroring
 * `__resetAuditFieldAllowlistRegistryForTests`'s own convention — never
 * called by application code. */
export function __resetControlAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
