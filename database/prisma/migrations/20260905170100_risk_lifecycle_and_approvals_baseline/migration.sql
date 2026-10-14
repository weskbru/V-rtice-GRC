-- T153/US6 — Risk Lifecycle and Approvals baseline: `RiskLifecycleTransition`
-- and `Approval` (data-model.md §11, ADR-006, FR-029/FR-029a-d, FR-079 to
-- FR-085), plus the `risks.pending_approval_id` FK deferred from the US2
-- baseline migration (`20260905140100_risk_management_baseline` — see that
-- model's own header in schema.prisma).
--
-- Hand-written (never `prisma migrate dev` — see schema.prisma's header and
-- docs/local-environment.md), corresponding 1:1 to the models added to
-- schema.prisma in this same change, with the additions Prisma's schema
-- language cannot express: the `CHECK` constraint enforcing segregation of
-- duties at the database, the partial unique index limiting one PENDING
-- approval per entity, and `Approval`'s append-only enforcement trigger
-- (all documented at their own statements below).

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovableEntityType" AS ENUM ('RISK');

-- CreateTable
CREATE TABLE "risk_lifecycle_transitions" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "from_status" "RiskStatus" NOT NULL,
    "to_status" "RiskStatus" NOT NULL,
    "performed_by_user_id" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ(6) NOT NULL,
    "justification" TEXT,
    "approval_id" UUID,

    CONSTRAINT "risk_lifecycle_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "entity_type" "ApprovableEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "requested_transition" TEXT NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "justification" TEXT,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_lifecycle_transitions_risk_id_performed_at_idx" ON "risk_lifecycle_transitions"("risk_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "approvals_status_entity_type_entity_id_idx" ON "approvals"("status", "entity_type", "entity_id");

-- CreateIndex — FR-029a database backstop against segregation-of-duties
-- violations: a self-decided approval can never be committed, regardless of
-- which application code path attempted it.
ALTER TABLE "approvals"
    ADD CONSTRAINT "approvals_decided_by_requester_check"
    CHECK ("decided_by_user_id" IS NULL OR "decided_by_user_id" <> "requested_by_user_id");

-- CreateIndex — data-model.md §11: "one PENDING approval per
-- (entityType, entityId)" (FR-029c's pending-condition rule, backstopping
-- `RequestApprovalUseCase`'s own application-level check with a real
-- database guarantee against a race between two simultaneous requests).
-- Prisma's schema language has no partial-index syntax, hence hand-written
-- SQL here rather than a `@@unique` in schema.prisma — the same documented
-- drift pattern as `risk_methodologies.is_active`'s own partial unique
-- index (`20260905150100_risk_assessment_methodology_baseline`) and the
-- three risk relationship link tables' "one active link" indexes
-- (`20260905160100_risk_treatment_and_relationships_baseline`).
CREATE UNIQUE INDEX "approvals_one_pending_per_entity"
    ON "approvals"("entity_type", "entity_id")
    WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "risk_lifecycle_transitions" ADD CONSTRAINT "risk_lifecycle_transitions_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_lifecycle_transitions" ADD CONSTRAINT "risk_lifecycle_transitions_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_lifecycle_transitions" ADD CONSTRAINT "risk_lifecycle_transitions_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — deliberately NO FK from `approvals.entity_id` to `risks`:
-- `entityType`/`entityId` is the documented polymorphic exception (ADR-008,
-- same shape as comments/attachments) so a future module's own approvable
-- entity type participates without a schema change to this table.
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — the `risks.pending_approval_id` column already exists
-- (created plain, with no FK, by `20260905140100_risk_management_baseline`
-- — see that model's own header in schema.prisma for why it was deferred).
-- `approvals` now exists, so the FK is added here.
ALTER TABLE "risks" ADD CONSTRAINT "risks_pending_approval_id_fkey" FOREIGN KEY ("pending_approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- `RiskLifecycleTransition` append-only enforcement (FR-083) — interpretive
-- decision, documented per this task's explicit instruction to justify it.
-- ---------------------------------------------------------------------------
--
-- DECISION: privilege revocation only (`RiskMethodologyVersion`'s precedent,
-- `20260905150100_risk_assessment_methodology_baseline`), NOT a trigger
-- (`RiskTreatmentDecision`'s precedent, `20260905160100_risk_treatment_and_
-- relationships_baseline`).
--
-- The choice between the two precedents turns on one question: does ANY
-- application code path ever need to UPDATE this table after the initial
-- INSERT? For `risk_treatment_decisions`, the answer is yes — FR-073
-- REQUIRES exactly one legitimate mutation (stamping `supersededAt` on the
-- row a new decision replaces), so a blanket `REVOKE UPDATE` would make the
-- feature itself inoperable and a trigger permitting exactly that one shape
-- of `UPDATE` is the only mechanism that enforces append-only-ness without
-- breaking the requirement.
--
-- `risk_lifecycle_transitions` has NO such requirement. A transition row
-- records "the risk moved from X to Y, performed by this user, at this
-- instant" — a historical fact that is complete and correct the moment it
-- is inserted (`PerformTransitionUseCase`/`DecideApprovalUseCase`, T156/
-- T157). No later event ever needs to revise a PAST transition's
-- `fromStatus`/`toStatus`/`performedByUserId`/`performedAt`/`justification`/
-- `approvalId` — unlike `risk_treatment_decisions`, there is no
-- "supersession" concept for a transition; the NEXT transition is simply a
-- NEW row. Revoking `UPDATE`/`DELETE` from `vertice_app` therefore removes
-- every legitimate application code path that could violate append-only-ness
-- (there are none to preserve), exactly matching `RiskMethodologyVersion`'s
-- own reasoning: "the application NEVER has a legitimate reason to UPDATE or
-- DELETE this table ... revoking the privilege from the ONE role that ever
-- connects as the running application removes every application code path
-- that could do it, by construction". A trigger would be a strictly
-- redundant SECOND backstop against the OWNER role running an ad hoc
-- statement directly — a real but narrower threat this migration accepts
-- the same way `RiskMethodologyVersion`'s own migration already accepted it
-- for the identical reason, not a table this platform's whole audit story
-- hinges on being intact (that distinction is `audit_event`'s alone,
-- ADR-005).
DO $$
DECLARE
    app_role text := (SELECT value FROM vertice_config WHERE key = 'app_role');
BEGIN
    IF app_role IS NULL THEN
        RAISE EXCEPTION 'vertice_config has no app_role row — cannot enforce risk_lifecycle_transitions append-only privileges';
    END IF;

    EXECUTE format('GRANT SELECT, INSERT ON %I TO %I', 'risk_lifecycle_transitions', app_role);
    EXECUTE format('REVOKE UPDATE, DELETE ON %I FROM %I', 'risk_lifecycle_transitions', app_role);
END;
$$;

-- ---------------------------------------------------------------------------
-- `Approval` append-only enforcement (FR-029b/FR-029c) — the OTHER half of
-- the same interpretive decision, resolved the OTHER way for the reason
-- explained above: this table DOES have exactly one legitimate mutation.
-- ---------------------------------------------------------------------------
--
-- A row is inserted `PENDING` (`RequestApprovalUseCase`, T157) and is
-- decided AT MOST once (`DecideApprovalUseCase`, T157): `status` moves to
-- `APPROVED` or `REJECTED`, and `decided_by_user_id`/`decided_at`/
-- `justification` are set together, in the SAME `UPDATE`. A blanket
-- `REVOKE UPDATE` would make deciding an approval impossible — the same
-- reasoning `risk_treatment_decisions_prevent_overwrite`'s own header gives
-- for why THAT table needed a trigger instead of a revocation. This trigger
-- follows that exact template, narrowly permitting:
--   - an `UPDATE` from `status = 'PENDING'` to `status IN ('APPROVED',
--     'REJECTED')`, that ALSO sets both `decided_by_user_id` and
--     `decided_at` (never one without the other), and leaves
--     `entity_type`/`entity_id`/`requested_transition`/
--     `requested_by_user_id`/`requested_at` untouched;
-- and rejecting everything else, including:
--   - any `DELETE` (no delete path exists or should ever exist — FR-029b's
--     "record each approval request and decision" is permanent);
--   - an `UPDATE` on a row that is ALREADY decided (`OLD.status <>
--     'PENDING'`) — no re-deciding, no changing a decision after the fact;
--   - an `UPDATE` that leaves `status = 'PENDING'` (i.e. touches the row for
--     any reason other than actually deciding it);
--   - an `UPDATE` that changes any of the request-side columns.
--
-- This gives FR-029b a REAL, database-enforced guarantee that a decision, once
-- recorded, is permanent — not merely an application convention — while
-- still allowing the one write path FR-029c's approval/rejection flow
-- requires. Combined with the `approvals_decided_by_requester_check`
-- constraint above, segregation of duties (FR-029a) and decision
-- immutability (FR-029b) both hold at the database level regardless of
-- which application code path attempts to violate them.
CREATE OR REPLACE FUNCTION approvals_prevent_overwrite() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'approvals is append-only: DELETE is not permitted (row id %)', OLD.id;
    END IF;

    -- TG_OP = 'UPDATE' from here on.
    IF OLD.status <> 'PENDING' THEN
        RAISE EXCEPTION 'approvals row % is already decided and cannot be modified again', OLD.id;
    END IF;

    IF NEW.status = 'PENDING' THEN
        RAISE EXCEPTION 'approvals row % may only be updated to record a decision (status APPROVED or REJECTED)', OLD.id;
    END IF;

    IF NEW.decided_by_user_id IS NULL OR NEW.decided_at IS NULL THEN
        RAISE EXCEPTION 'approvals row % must set decided_by_user_id and decided_at when recording a decision', OLD.id;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.entity_type IS DISTINCT FROM OLD.entity_type
        OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
        OR NEW.requested_transition IS DISTINCT FROM OLD.requested_transition
        OR NEW.requested_by_user_id IS DISTINCT FROM OLD.requested_by_user_id
        OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
    THEN
        RAISE EXCEPTION 'approvals row % is append-only: only status/decided_by_user_id/decided_at/justification may change, and only once', OLD.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approvals_append_only
    BEFORE UPDATE OR DELETE ON "approvals"
    FOR EACH ROW EXECUTE FUNCTION approvals_prevent_overwrite();
