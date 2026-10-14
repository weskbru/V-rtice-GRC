-- T007/004-compliance-management — additive growth of `AuditEntityType`
-- (ADR-008: "closed platform enums grow by reviewed migration"), the same
-- growth pattern `20260907090000_audit_entity_type_add_grc_foundation` and
-- `20260908090000_audit_entity_type_add_control_assessment_and_links`
-- already applied. Seven distinct values, one per business fact this
-- module's contract names (FR-025, data-model.md §9) — never one generic
-- "compliance" value:
--
--   * `FRAMEWORK` — a framework's own descriptive fields (create/update).
--   * `FRAMEWORK_VERSION` — a version's own fields, including the
--     DRAFT->PUBLISHED status transition (research.md D-3: captured as a
--     field change on this same type, not a separate lifecycle-transition
--     type — unlike CONTROL_LIFECYCLE_TRANSITION, because this lifecycle
--     has exactly one edge, firing at most once per version).
--   * `REQUIREMENT` — a clause's own fields (create/update while DRAFT).
--   * `REQUIREMENT_CONTROL_LINK` — the requirement<->control mapping
--     (link/unlink), data-model.md §4, ADR-020 part 1 (US2, out of this
--     migration's own workstream scope — schema-only here).
--   * `REQUIREMENT_CONTROL_MAPPING_MIGRATION` — one event per migration
--     execution, never one per copied link (SC-004, data-model.md §5).
--   * `REQUIREMENT_APPLICABILITY` — a not-applicable declaration and its
--     revocation (data-model.md §6).
--   * `REQUIREMENT_COMPLIANCE_STATE` — a compliance-state change, audited
--     at observation time (research.md D-11, data-model.md §7).
--
-- Grouped in one migration/transaction, as `20260907110300_closed_type_
-- registries_add_control` and `20260908090000_audit_entity_type_add_
-- control_assessment_and_links` already did for their own unrelated-but-
-- co-shipped values. A value added by `ALTER TYPE ... ADD VALUE` cannot be
-- referenced by any statement in the SAME transaction that added it — this
-- migration contains only `ADD VALUE` statements and writes no row using
-- any of them.
ALTER TYPE "AuditEntityType" ADD VALUE 'FRAMEWORK';
ALTER TYPE "AuditEntityType" ADD VALUE 'FRAMEWORK_VERSION';
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUIREMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUIREMENT_CONTROL_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUIREMENT_CONTROL_MAPPING_MIGRATION';
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUIREMENT_APPLICABILITY';
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUIREMENT_COMPLIANCE_STATE';
