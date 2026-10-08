-- T036/003-controls-management, User Story 2/3 — additive growth of
-- `AuditEntityType` (ADR-008: "closed platform enums grow by reviewed
-- migration"), the same growth pattern
-- `20260907090000_audit_entity_type_add_grc_foundation` already applied for
-- EVIDENCE/EVIDENCE_LINK/ACTION/FINDING:
--
--   * `CONTROL_ASSESSMENT` — an assessment's own record and its attestation
--     decision (data-model.md §2/§4, FR-019, FR-020).
--   * `CONTROL_PROCESS_LINK` — the control-to-process relationship
--     (data-model.md §5, ADR-020 part 1).
--   * `CONTROL_ASSET_LINK` — the control-to-asset relationship (data-model.md
--     §5, ADR-020 part 1).
--
-- Three independent values with no cross-reference between them, so they are
-- grouped in one migration file/transaction — as `20260907110300_closed_type_
-- registries_add_control` already did for three unrelated closed-type
-- registries. The restriction that migration documented at length applies
-- here too: a value added by `ALTER TYPE ... ADD VALUE` cannot be referenced
-- by any statement in the SAME transaction that added it. This migration
-- contains only `ADD VALUE` statements and writes no row using any of them.
ALTER TYPE "AuditEntityType" ADD VALUE 'CONTROL_ASSESSMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'CONTROL_PROCESS_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'CONTROL_ASSET_LINK';
