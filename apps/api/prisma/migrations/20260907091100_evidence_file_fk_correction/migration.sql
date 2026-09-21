-- 002-shared-grc-foundation, US1 design correction (T017-T038) — corrects
-- `Evidence.fileId`, added at T005/T007
-- (`20260907090100_grc_foundation_baseline`) as a real FK to
-- `Attachment.id`. That combination could never work: `Attachment`
-- requires its parent to already exist before it can be created
-- (`UploadService`/`getAttachableEntityAccessor(...)
-- .resolveViewableParent` throws if the parent does not exist), so
-- `Evidence.file_id` was necessarily NULL at the moment an evidence row
-- is inserted — a column no `INSERT` could ever legally populate at the
-- instant `evidence_has_substance_check` (below) was evaluated. In
-- practice, the CHECK always forced `external_url` or `observation`, and
-- file-only evidence was impossible to create. See `schema.prisma`'s own
-- `Evidence` section header comment for the full account, and
-- `20260907091000_attachable_entity_type_add_evidence` (which MUST be
-- applied before this one) for the replacement mechanism: a file now
-- reaches evidence through the generic `Attachment` row
-- (`entity_type = 'EVIDENCE'`), created strictly AFTER the evidence row
-- exists — the only order that was ever going to work.
--
-- Additive in spirit even though it drops a column: `20260907090100_grc_
-- foundation_baseline` is already-applied history and is NOT edited (this
-- project's standing rule — hand-written SQL, `prisma migrate deploy`,
-- never editing a migration once applied). This is a NEW, later migration
-- that corrects course, the same way a future ADR would supersede an
-- earlier one rather than rewriting it.

-- Drop the FK, the CHECK that referenced `file_id`, and the column itself,
-- in dependency order. There was never a separate index on `file_id`
-- (confirmed against `schema.prisma`'s `Evidence`/`Attachment` models and
-- this table's own `CreateIndex` statements in the baseline migration —
-- only `evidence_org_unit_id_status_idx`, `evidence_valid_until_status_idx`
-- and `evidence_owner_user_id_status_idx` exist), so there is no index to
-- drop beyond the FK's own implicit constraint.
ALTER TABLE "evidence" DROP CONSTRAINT "evidence_has_substance_check";
ALTER TABLE "evidence" DROP CONSTRAINT "evidence_file_id_fkey";
ALTER TABLE "evidence" DROP COLUMN "file_id";

-- Invariant E1, narrowed (data-model.md §2, revised): "ao menos um de
-- external_url, observation preenchido" — `file_id` no longer participates
-- because it no longer exists on this table. This is a DELIBERATE
-- narrowing, not merely a mechanical follow-on of dropping the column:
-- evidence backed by a file (via the `Attachment` mechanism above) now
-- ALWAYS also carries at least a one-line `observation` describing what
-- the file shows — "penetration test report covering the admin API" is
-- more useful to an auditor than a bare filename — which is what keeps
-- FR-002's intent ("evidence is always readable by a human") enforceable
-- at the database, the same "the database is the last line" reasoning
-- already applied to `approvals_decided_by_requester_check`
-- (`20260905170100_risk_lifecycle_and_approvals_baseline`) and to this
-- same CHECK's original form.
ALTER TABLE "evidence"
    ADD CONSTRAINT "evidence_has_substance_check"
    CHECK ("external_url" IS NOT NULL OR "observation" IS NOT NULL);
