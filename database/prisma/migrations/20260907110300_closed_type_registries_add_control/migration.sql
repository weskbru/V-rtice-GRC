-- T004/003-controls-management — additive growth of three existing closed
-- type registries (ADR-008: "closed platform enums grow by reviewed
-- migration"), the same growth pattern
-- `20260907091000_attachable_entity_type_add_evidence` already applied to
-- `AttachableEntityType`:
--
--   * `ApprovableEntityType` += `CONTROL_ASSESSMENT` (data-model.md §4) —
--     lets a `ControlAssessment`'s attestation cycle reuse the existing
--     generic `Approval` mechanism (research.md D-3).
--   * `EvidenceSubjectType` += `CONTROL` (data-model.md §7, FR-026) — lets
--     evidence attach to a control by the same closed-type mechanism every
--     other subject already uses.
--   * `ActionOriginType` += `CONTROL_ASSESSMENT` (data-model.md §7, FR-027,
--     research.md D-5) — the origin is the FACT that justifies remediation
--     (a failed verification), never the generic `CONTROL` entity itself.
--
-- All three are independent enum types with no cross-reference between
-- them, so they are grouped in one migration file/transaction. The
-- restriction this migration DOES respect (documented at length by the
-- precedent above): a value added by `ALTER TYPE ... ADD VALUE` cannot be
-- referenced by any statement in the SAME transaction that added it. This
-- migration contains only `ADD VALUE` statements and writes no row using
-- any of them — the first real use of each is at normal application
-- runtime, in an entirely separate transaction, long after `prisma migrate
-- deploy` has committed this one.
ALTER TYPE "ApprovableEntityType" ADD VALUE 'CONTROL_ASSESSMENT';
ALTER TYPE "EvidenceSubjectType" ADD VALUE 'CONTROL';
ALTER TYPE "ActionOriginType" ADD VALUE 'CONTROL_ASSESSMENT';
