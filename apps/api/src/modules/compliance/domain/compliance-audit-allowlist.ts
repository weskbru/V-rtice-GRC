/**
 * T012/004-compliance-management — registers the field allow-lists for
 * every `AuditEntityType` value this module owns (`core/audit/domain/
 * audit-field-allowlist.ts`, FR-025, data-model.md §9). Follows
 * `modules/controls/domain/control-audit-allowlist.ts`'s exact convention
 * — see that file's header for why this is a registry call, not a
 * hard-coded object literal in `core/audit/**` (ADR-011).
 *
 * All seven `AuditEntityType` values this module's schema owns are
 * registered here in one pass (data-model.md §9), even though the write
 * paths for four of them (`REQUIREMENT_CONTROL_LINK`,
 * `REQUIREMENT_CONTROL_MAPPING_MIGRATION`, `REQUIREMENT_APPLICABILITY`,
 * `REQUIREMENT_COMPLIANCE_STATE`) belong to User Story 2/3, out of this
 * workstream's own scope — `AuditFieldAllowlistNotRegisteredError` is a
 * fail-loud guard against a MISSING registration, not a per-operation
 * gate, so registering all seven now (mirroring how the Fase 1 migration
 * ships every table the whole feature needs) means a future workstream
 * only has to call `AuditRecorder.record(...)`, never touch this file.
 *
 * ## Where this must be called from
 *
 * Every use case that records an audit event for one of these entity
 * types calls `registerComplianceAuditAllowlists()` from its own
 * constructor — the same idempotent, "called from every entry point"
 * convention `registerControlAuditAllowlists`/`registerRiskAuditAllowlists`
 * already establish, so a test wiring one use case in isolation (without
 * booting the full `ComplianceModule`) still has the registration in
 * place before it ever calls `AuditRecorder.record(...)`.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process (multiple
 * Nest testing modules within one test run), exactly like
 * `registerControlAuditAllowlists`/`registerRiskAuditAllowlists`. */
export function registerComplianceAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  // `CreateFrameworkUseCase`/`UpdateFrameworkUseCase` audit the
  // framework's own descriptive fields — `code`/`version` are deliberately
  // excluded: `code` never changes after creation (data-model.md §1) and
  // is already the audit row's own `entityId` context; `version` is the
  // optimistic-lock counter, not business content.
  registerAuditFieldAllowlist(AuditEntityType.FRAMEWORK, ['name', 'description', 'origin']);

  // `CreateFrameworkVersionUseCase`/`UpdateFrameworkVersionUseCase`/
  // `PublishFrameworkVersionUseCase` share this one entity type
  // (research.md D-3: publication is a field change, not a separate
  // lifecycle-transition type). `status`/`publishedAt`/`publishedByUserId`
  // ARE eligible here — unlike Controls' own lifecycle, which routes
  // through a dedicated `CONTROL_LIFECYCLE_TRANSITION` type instead —
  // because this two-state, one-edge lifecycle is captured as a plain
  // field change on the SAME entity type its own descriptive edit uses.
  registerAuditFieldAllowlist(AuditEntityType.FRAMEWORK_VERSION, [
    'label',
    'status',
    'publishedAt',
    'publishedByUserId',
  ]);

  // `CreateRequirementUseCase`/`UpdateRequirementUseCase` audit the
  // clause's own text fields. `complianceState` is never eligible — it is
  // derived, never a column (FR-017, §19.7).
  registerAuditFieldAllowlist(AuditEntityType.REQUIREMENT, ['externalRef', 'title', 'description']);

  // User Story 2 (out of this workstream's own scope) — link/unlink
  // audits the two identifiers FR-010 names.
  registerAuditFieldAllowlist(AuditEntityType.REQUIREMENT_CONTROL_LINK, [
    'requirementId',
    'controlId',
    'linkedAt',
    'unlinkedAt',
  ]);

  // User Story 2 — one event per execution (SC-004): the summary counts by
  // outcome, plus the source/target versions, never a per-link record.
  registerAuditFieldAllowlist(AuditEntityType.REQUIREMENT_CONTROL_MAPPING_MIGRATION, [
    'frameworkId',
    'sourceFrameworkVersionId',
    'targetFrameworkVersionId',
    'copiedCount',
    'pendingDecisionCount',
    'skippedAlreadyMappedCount',
  ]);

  // User Story 3 — declare/revert audits the justification and the
  // declaration's own lifecycle timestamps.
  registerAuditFieldAllowlist(AuditEntityType.REQUIREMENT_APPLICABILITY, [
    'requirementId',
    'justification',
    'declaredAt',
    'revokedAt',
  ]);

  // User Story 3 — a compliance-state change is append-only from this
  // audit type's own point of view (research.md D-11): every field IS the
  // "new value" the observation recorded, mirroring
  // `CONTROL_LIFECYCLE_TRANSITION`'s own allow-list shape.
  registerAuditFieldAllowlist(AuditEntityType.REQUIREMENT_COMPLIANCE_STATE, [
    'requirementId',
    'previousState',
    'newState',
    'observedAt',
  ]);
}

/** Test-only escape hatch, mirroring
 * `__resetControlAuditAllowlistRegistrationForTests`'s own convention —
 * never called by application code. */
export function __resetComplianceAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
