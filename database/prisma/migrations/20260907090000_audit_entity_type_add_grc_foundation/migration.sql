-- T010/002-shared-grc-foundation — additive growth of the `AuditEntityType`
-- enum: adds `EVIDENCE`, `EVIDENCE_LINK`, `ACTION`, `FINDING` (ADR-008:
-- "closed platform enums grow by reviewed migration"). Four distinct
-- values, not one generic "grc" value — the same reasoning already applied
-- to every other cross-cutting capability's entities
-- (`20260905180000_audit_entity_type_add_collaboration`,
-- `20260905170000_audit_entity_type_add_risk_lifecycle`): each is a
-- different business fact with its own audit field allow-list
-- (`grc/shared/domain/grc-audit-allowlist.ts`, T014), and a link
-- (`EVIDENCE_LINK`) is audited separately from the evidence it links, the
-- same way `RISK_CONTROL_LINK` is separate from `RISK`.
--
-- ## The PostgreSQL restriction this migration must respect
--
-- Same restriction as every prior `audit_entity_type_add_*` migration: a
-- value added by `ALTER TYPE ... ADD VALUE` cannot be referenced by any
-- statement in the SAME transaction that added it. This migration contains
-- only the four `ADD VALUE` statements and writes no data using any of
-- them — nor does the migration that runs immediately after it
-- (`20260907090100_grc_foundation_baseline`), which only creates
-- tables/enums/indexes/constraints and writes no `audit_event` rows. The
-- first real use of each new label is `AuditRecorder.record(...)` called
-- at normal application runtime, in an entirely separate transaction opened
-- long after `prisma migrate deploy` has committed this one.
ALTER TYPE "AuditEntityType" ADD VALUE 'EVIDENCE';
ALTER TYPE "AuditEntityType" ADD VALUE 'EVIDENCE_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'ACTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'FINDING';
