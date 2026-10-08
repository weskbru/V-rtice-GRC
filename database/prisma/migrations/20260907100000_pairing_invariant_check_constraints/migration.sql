-- Assurance fix (Fix 5, confirmed gap) — several "these two columns are
-- filled together or neither" invariants in schema.prisma's GRC Shared
-- Kernel section (Evidence's E3, EvidenceLink's L2, Action's A1 pairing
-- half, Finding's closed/archived pairing) were documented as
-- "domain-enforced" but enforced by nothing at the database: the guarantee
-- was only that one use case happened to write both columns together. This
-- adds real, additive, single-table CHECK constraints for exactly those
-- pairings, hand-written per this project's standing rule for constructs
-- Prisma's schema language cannot express (`@@check` does not exist in
-- this codebase's Prisma version usage — see schema.prisma's own section
-- header on Invariant E1/L1 for the identical reasoning already applied
-- once).
--
-- Deliberately NOT attempted here (left domain-enforced, per this fix's own
-- brief):
--   * Finding's F1 (closing requires a completed linked Action OR a
--     justification) — spans `actions`, a single-table CHECK cannot see it.
--   * Finding's F2 (segregation of duties: closedByUserId != any completed
--     linked Action's responsibleUserId) — spans `actions` too.
--   * Finding's F4 (only a CLOSED finding may be archived) — needs the
--     PREVIOUS status at the moment of the transition, which a CHECK
--     evaluated against the row's OWN current values cannot express.
--   * No upper bound is added to any risk-assessment probability/impact
--     scale — the ceiling depends on the methodology version in effect,
--     not a fixed constant (unrelated table, called out here only because
--     the brief that produced this migration explicitly named it as an
--     anti-goal).
--
-- Before writing this migration, every one of the four tables below was
-- checked against the running database for existing rows that would
-- violate the new constraint. All four returned zero:
--   SELECT count(*) FROM evidence       WHERE (archived_at IS NULL) <> (archived_by_user_id IS NULL);       -- 0
--   SELECT count(*) FROM evidence_links WHERE (unlinked_at IS NULL) <> (unlinked_by_user_id IS NULL);       -- 0
--   SELECT count(*) FROM actions        WHERE (completed_at IS NULL) <> (completed_by_user_id IS NULL);     -- 0
--   SELECT count(*) FROM actions        WHERE (status = 'COMPLETED') <> (completed_at IS NOT NULL);         -- 0
--   SELECT count(*) FROM actions        WHERE (reopened_at IS NULL) <> (reopened_by_user_id IS NULL);       -- 0
--   SELECT count(*) FROM findings       WHERE (closed_at IS NULL) <> (closed_by_user_id IS NULL);           -- 0
--   SELECT count(*) FROM findings       WHERE (archived_at IS NULL) <> (archived_by_user_id IS NULL);       -- 0
-- Had any of these been nonzero, this migration would have been withheld
-- and reported rather than shipped against real data it would fail on.

-- Invariant E3 — `evidence.archived_at`/`archived_by_user_id` paired.
ALTER TABLE "evidence"
    ADD CONSTRAINT "evidence_archived_pair_check"
    CHECK (("archived_at" IS NULL) = ("archived_by_user_id" IS NULL));

-- Invariant L2 — `evidence_links.unlinked_at`/`unlinked_by_user_id` paired.
ALTER TABLE "evidence_links"
    ADD CONSTRAINT "evidence_links_unlinked_pair_check"
    CHECK (("unlinked_at" IS NULL) = ("unlinked_by_user_id" IS NULL));

-- Invariant A1 — `actions.completed_at`/`completed_by_user_id` paired, AND
-- `completed_at` is set if and only if `status = 'COMPLETED'`. The second
-- clause is the exact rule schema.prisma's own Invariant A1 comment states
-- in words ("completedAt preenchido se e somente se status = COMPLETED");
-- both clauses are independent (the pairing could hold while the status
-- half is violated, e.g. a COMPLETED row with both columns null) and are
-- therefore two separate checks, not one.
ALTER TABLE "actions"
    ADD CONSTRAINT "actions_completed_pair_check"
    CHECK (("completed_at" IS NULL) = ("completed_by_user_id" IS NULL));
ALTER TABLE "actions"
    ADD CONSTRAINT "actions_completed_status_check"
    CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));

-- `actions.reopened_at`/`reopened_by_user_id` paired (no analogous status
-- co-constraint: reopening always transitions TO `OPEN`, but `OPEN` is also
-- an action's initial status pre-reopen, so `status = 'OPEN'` cannot imply
-- `reopened_at IS NOT NULL` the way `COMPLETED` implies `completed_at`).
ALTER TABLE "actions"
    ADD CONSTRAINT "actions_reopened_pair_check"
    CHECK (("reopened_at" IS NULL) = ("reopened_by_user_id" IS NULL));

-- `findings.closed_at`/`closed_by_user_id` paired (the pairing only — F1's
-- substantive "requires a completed action or justification" and F2's
-- segregation of duties are explicitly NOT attempted here, see this file's
-- header).
ALTER TABLE "findings"
    ADD CONSTRAINT "findings_closed_pair_check"
    CHECK (("closed_at" IS NULL) = ("closed_by_user_id" IS NULL));

-- `findings.archived_at`/`archived_by_user_id` paired (the pairing only —
-- F4's "only a CLOSED finding may be archived" is explicitly NOT attempted
-- here, see this file's header).
ALTER TABLE "findings"
    ADD CONSTRAINT "findings_archived_pair_check"
    CHECK (("archived_at" IS NULL) = ("archived_by_user_id" IS NULL));
