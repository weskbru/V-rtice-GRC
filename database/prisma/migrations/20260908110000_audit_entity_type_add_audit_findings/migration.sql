-- T005/005-audit-findings — additive growth of `AuditEntityType`
-- (ADR-008: "closed platform enums grow by reviewed migration"), the same
-- growth pattern `20260908100000_audit_entity_type_add_compliance` and
-- every prior enum-growth migration already applied. Six distinct values,
-- one per business fact this module's contract names (FR-020,
-- data-model.md §8) — never one generic value:
--
--   * `AUDIT_ENGAGEMENT` — the engagement's own descriptive fields and all
--     four lifecycle transitions (start/complete/cancel), captured as a
--     field change on this same type (research.md D-3's own reasoning for
--     `FRAMEWORK_VERSION`: few, linear, at-most-once edges).
--   * `AUDIT_SCOPE_FRAMEWORK_VERSION` / `AUDIT_SCOPE_REQUIREMENT` /
--     `AUDIT_SCOPE_CONTROL` — one value per scope-link kind (data-model.md
--     §2-§4), the same reasoning `RISK_CONTROL_LINK`/`RISK_PROCESS_LINK`/
--     `RISK_ASSET_LINK` already established.
--   * `FINDING_CONTROL_LINK` / `FINDING_RISK_LINK` — the two `Finding`
--     relationships Phase 1 deferred (data-model.md §5-§6, ADR-020 parts
--     1/2), owned by `grc/finding` — grouped in the same reviewed
--     migration because they are unrelated-but-co-shipped values, the same
--     precedent `20260908090000_audit_entity_type_add_control_assessment_
--     and_links` already set.
--
-- A value added by `ALTER TYPE ... ADD VALUE` cannot be referenced by any
-- statement in the SAME transaction that added it — this migration
-- contains only `ADD VALUE` statements and writes no row using any of them.
ALTER TYPE "AuditEntityType" ADD VALUE 'AUDIT_ENGAGEMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'AUDIT_SCOPE_FRAMEWORK_VERSION';
ALTER TYPE "AuditEntityType" ADD VALUE 'AUDIT_SCOPE_REQUIREMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'AUDIT_SCOPE_CONTROL';
ALTER TYPE "AuditEntityType" ADD VALUE 'FINDING_CONTROL_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'FINDING_RISK_LINK';
