-- T120/T124/T126/US4 — Additive growth of the `AuditEntityType` enum: adds
-- `RISK_ASSESSMENT` and `RISK_METHODOLOGY_VERSION` (ADR-008: "closed
-- platform enums grow by reviewed migration"), the same mechanism as
-- `20260905140000_audit_entity_type_add_risk`.
--
-- ## The PostgreSQL restriction this migration must respect (see that
-- ## earlier migration's header for the full explanation)
--
-- A value added by `ALTER TYPE ... ADD VALUE` inside a transaction cannot be
-- referenced (compared, cast, used as a literal) by any statement in the
-- SAME transaction that added it. This migration contains exactly two such
-- statements and writes no `audit_event` row using either new label — the
-- first real use of `AuditEntityType.RISK_ASSESSMENT` is
-- `AuditRecorder.record(...)` from `CreateAssessmentUseCase`, and of
-- `AuditEntityType.RISK_METHODOLOGY_VERSION` is the same call from
-- `PublishMethodologyVersionUseCase` — both at normal application runtime,
-- in transactions opened long after `prisma migrate deploy` has committed
-- this one.
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_ASSESSMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_METHODOLOGY_VERSION';
