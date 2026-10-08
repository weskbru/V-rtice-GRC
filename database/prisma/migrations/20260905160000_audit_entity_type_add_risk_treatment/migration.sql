-- T137/T139/T140/T142/US5 — Additive growth of the `AuditEntityType` enum:
-- adds `RISK_TREATMENT_DECISION`, `RISK_TREATMENT_ACTION`,
-- `RISK_CONTROL_LINK`, `RISK_PROCESS_LINK` and `RISK_ASSET_LINK` (ADR-008:
-- "closed platform enums grow by reviewed migration"). Five distinct values
-- rather than one generic "relationship" value — CLAUDE.md §10/ADR-008 model
-- each risk relationship explicitly, and the audit trail is exactly the
-- place that distinction must not be lost.
--
-- ## The PostgreSQL restriction this migration must respect
--
-- Same restriction as `20260905140000_audit_entity_type_add_risk` and
-- `20260905150000_audit_entity_type_add_risk_assessment_methodology`
-- (see those files' own headers for the full explanation): a value added by
-- `ALTER TYPE ... ADD VALUE` cannot be referenced by any statement in the
-- SAME transaction that added it. This migration contains only five such
-- statements and writes no data using any of the new labels — nor does the
-- migration that runs immediately after it
-- (`20260905160100_risk_treatment_and_relationships_baseline`), which only
-- creates tables/indexes/constraints and writes no `audit_event` rows. The
-- first real use of each new label is `AuditRecorder.record(...)` called at
-- normal application runtime, in an entirely separate transaction opened
-- long after `prisma migrate deploy` has committed this one.
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_TREATMENT_DECISION';
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_TREATMENT_ACTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_CONTROL_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_PROCESS_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_ASSET_LINK';
