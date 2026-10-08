-- T206a — THROWAWAY PROBE (SC-011 verification, ADR-011). Additive growth of
-- three closed enums for `modules/_extensibility_probe/`'s own entity type,
-- exactly the pattern every other cross-cutting capability's entity types
-- already followed (`20260905180000_audit_entity_type_add_collaboration`,
-- etc.) — this is the one step ADR-008/`entity-registry.ts` document as
-- "not purely a code-level registration" for a future module.
--
-- Same PostgreSQL restriction as every prior `_add_*` migration: a value
-- added by `ALTER TYPE ... ADD VALUE` cannot be referenced by any statement
-- in the SAME transaction that added it. This migration only adds labels
-- and writes no row using any of them.
--
-- REVERSIBILITY NOTE (F-20-adjacent): PostgreSQL has no `ALTER TYPE ... DROP
-- VALUE`. Once T206a's probe module is removed, these three labels stay in
-- their enums permanently — recorded in docs/deferred-findings.md rather
-- than attempted as a live type-recreation against a database in active use.
ALTER TYPE "AuditEntityType" ADD VALUE 'PROBE_RECORD';
ALTER TYPE "AttachableEntityType" ADD VALUE 'PROBE_RECORD';
ALTER TYPE "CommentableEntityType" ADD VALUE 'PROBE_RECORD';
