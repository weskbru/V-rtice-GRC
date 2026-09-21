-- T137/T138/US5 — Risk Treatment, Actions, Controls, Processes and Assets
-- baseline: `RiskTreatmentDecision`, `RiskTreatmentAction`, `Control`,
-- `Process`, `Asset`, `RiskControlLink`, `RiskProcessLink`, `RiskAssetLink`
-- (data-model.md §10), plus the `risks.current_treatment_id` FK deferred
-- from the US2 baseline migration (`20260905140100_risk_management_baseline`
-- — see that model's own header in schema.prisma).
--
-- Hand-written (never `prisma migrate dev` — see schema.prisma's header and
-- docs/local-environment.md), corresponding 1:1 to the models added to
-- schema.prisma in this same change, with the additions Prisma's schema
-- language cannot express: the partial unique indexes on the three link
-- tables, and `RiskTreatmentDecision`'s append-only enforcement trigger
-- (both documented at their own statements below).

-- CreateEnum
CREATE TYPE "TreatmentStrategy" AS ENUM ('MITIGATE', 'AVOID', 'TRANSFER', 'ACCEPT');

-- CreateEnum
CREATE TYPE "TreatmentActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "risk_treatment_decisions" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "strategy" "TreatmentStrategy" NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" DATE,
    "decided_by_user_id" UUID NOT NULL,
    "decided_at" TIMESTAMPTZ(6) NOT NULL,
    "superseded_at" TIMESTAMPTZ(6),
    "superseded_by_id" UUID,

    CONSTRAINT "risk_treatment_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_treatment_actions" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "treatment_decision_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsible_user_id" UUID NOT NULL,
    "due_on" DATE NOT NULL,
    "status" "TreatmentActionStatus" NOT NULL DEFAULT 'OPEN',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risk_treatment_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controls" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "org_unit_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "org_unit_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "org_unit_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_control_links" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "risk_control_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_process_links" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "risk_process_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_asset_links" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "risk_asset_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — data-model.md §10: "(riskId, decidedAt DESC)".
CREATE INDEX "risk_treatment_decisions_risk_id_decided_at_idx" ON "risk_treatment_decisions"("risk_id", "decided_at" DESC);

-- CreateIndex — data-model.md §10: "(riskId, status), (responsibleUserId,
-- dueOn), (dueOn, status) for the dashboard's overdue tile".
CREATE INDEX "risk_treatment_actions_risk_id_status_idx" ON "risk_treatment_actions"("risk_id", "status");

-- CreateIndex
CREATE INDEX "risk_treatment_actions_responsible_user_id_due_on_idx" ON "risk_treatment_actions"("responsible_user_id", "due_on");

-- CreateIndex
CREATE INDEX "risk_treatment_actions_due_on_status_idx" ON "risk_treatment_actions"("due_on", "status");

-- CreateIndex
CREATE UNIQUE INDEX "controls_code_key" ON "controls"("code");

-- CreateIndex
CREATE UNIQUE INDEX "processes_code_key" ON "processes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "assets_code_key" ON "assets"("code");

-- CreateIndex
CREATE INDEX "risk_control_links_risk_id_idx" ON "risk_control_links"("risk_id");

-- CreateIndex
CREATE INDEX "risk_process_links_risk_id_idx" ON "risk_process_links"("risk_id");

-- CreateIndex
CREATE INDEX "risk_asset_links_risk_id_idx" ON "risk_asset_links"("risk_id");

-- data-model.md §10: "Partial unique: (riskId, controlId) WHERE unlinkedAt
-- IS NULL" — Prisma's schema language has no partial-index syntax (as of
-- this Prisma version), so this is hand-written, the same documented drift
-- pattern already established for `risk_methodologies_one_active_idx`
-- (`20260905150100_risk_assessment_methodology_baseline`). This is what
-- makes "linking an already-linked control returns 409" (contracts/
-- risks.openapi.yaml's `linkControlToRisk`) a real database guarantee, not
-- merely an application-level check that a race could slip past: two
-- concurrent requests linking the SAME (risk, control) pair can only ever
-- have one succeed at the database level.
CREATE UNIQUE INDEX "risk_control_links_risk_id_control_id_active_key" ON "risk_control_links"("risk_id", "control_id") WHERE "unlinked_at" IS NULL;

-- Same rationale as above, against `risk_process_links`.
CREATE UNIQUE INDEX "risk_process_links_risk_id_process_id_active_key" ON "risk_process_links"("risk_id", "process_id") WHERE "unlinked_at" IS NULL;

-- Same rationale as above, against `risk_asset_links`.
CREATE UNIQUE INDEX "risk_asset_links_risk_id_asset_id_active_key" ON "risk_asset_links"("risk_id", "asset_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "risk_treatment_decisions" ADD CONSTRAINT "risk_treatment_decisions_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_decisions" ADD CONSTRAINT "risk_treatment_decisions_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_decisions" ADD CONSTRAINT "risk_treatment_decisions_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "risk_treatment_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_actions" ADD CONSTRAINT "risk_treatment_actions_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_actions" ADD CONSTRAINT "risk_treatment_actions_treatment_decision_id_fkey" FOREIGN KEY ("treatment_decision_id") REFERENCES "risk_treatment_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_actions" ADD CONSTRAINT "risk_treatment_actions_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controls" ADD CONSTRAINT "controls_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_process_links" ADD CONSTRAINT "risk_process_links_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_process_links" ADD CONSTRAINT "risk_process_links_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_process_links" ADD CONSTRAINT "risk_process_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_process_links" ADD CONSTRAINT "risk_process_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_asset_links" ADD CONSTRAINT "risk_asset_links_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_asset_links" ADD CONSTRAINT "risk_asset_links_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_asset_links" ADD CONSTRAINT "risk_asset_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_asset_links" ADD CONSTRAINT "risk_asset_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — the `risks.current_treatment_id` column already exists
-- (created plain, with no FK, by `20260905140100_risk_management_baseline`
-- — see that model's own header in schema.prisma for why it was deferred).
-- `risk_treatment_decisions` now exists, so the FK is added here.
ALTER TABLE "risks" ADD CONSTRAINT "risks_current_treatment_id_fkey" FOREIGN KEY ("current_treatment_id") REFERENCES "risk_treatment_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- `RiskTreatmentDecision` append-only enforcement (FR-073) — interpretive
-- decision, documented per this task's explicit instruction to justify it.
-- ---------------------------------------------------------------------------
--
-- DECISION: NOT a blanket `REVOKE UPDATE, DELETE` the way
-- `RiskMethodologyVersion` is (`20260905150100_risk_assessment_methodology_
-- baseline`). That table is NEVER updated by any application code path —
-- `PublishMethodologyVersionUseCase` only ever `create`s — so revoking the
-- privilege entirely removes every legitimate application code path that
-- could violate append-only-ness.
--
-- `risk_treatment_decisions` is different: FR-073 itself REQUIRES exactly
-- one legitimate mutation — "a new decision stamps `supersededAt` on the
-- previous one rather than overwriting it" (data-model.md §10). A blanket
-- `REVOKE UPDATE` would make `RecordTreatmentUseCase` (T139) unable to
-- perform the very operation FR-073 asks for. Revoking the privilege
-- entirely is therefore the WRONG mechanism here — it would not enforce
-- append-only-ness, it would make the feature inoperable.
--
-- Instead: a `BEFORE UPDATE OR DELETE` trigger — the same mechanism
-- `audit_event`'s own `audit_event_prevent_modification`
-- (`20260905120200_audit_event_append_only`) uses — narrowly scoped to
-- permit EXACTLY the one legitimate transition FR-073 describes, and reject
-- everything else, including:
--   - any `DELETE` (no delete path exists or should ever exist);
--   - an `UPDATE` that changes any business-content column (`risk_id`,
--     `strategy`, `description`, `deadline`, `decided_by_user_id`,
--     `decided_at`) — a decision, once decided, is a historical fact;
--   - an `UPDATE` that sets `superseded_at`/`superseded_by_id` on a row
--     that is ALREADY superseded (no double-supersession, no "unsuperseding"
--     by setting it back to NULL — `NEW.superseded_at IS NULL` is rejected
--     just as much as a second, different supersession would be);
--   - an `UPDATE` that leaves `superseded_at` NULL (i.e. touches the row for
--     any reason other than actually superseding it).
--
-- This gives FR-073 a REAL, database-enforced guarantee — not merely an
-- application convention — while still allowing the one write path the
-- requirement itself mandates. It is a stronger guarantee than
-- `RiskMethodologyVersion`'s (which permits zero updates) applied correctly
-- to a table that must permit exactly one: T133's integration test proves
-- the superseded row is unchanged in every OTHER column, and this trigger
-- is why that is guaranteed even if a future code path attempted a
-- different write.
CREATE OR REPLACE FUNCTION risk_treatment_decisions_prevent_overwrite() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'risk_treatment_decisions is append-only: DELETE is not permitted (row id %)', OLD.id;
    END IF;

    -- TG_OP = 'UPDATE' from here on.
    IF OLD.superseded_at IS NOT NULL THEN
        RAISE EXCEPTION 'risk_treatment_decisions row % is already superseded and cannot be modified again', OLD.id;
    END IF;

    IF NEW.superseded_at IS NULL THEN
        RAISE EXCEPTION 'risk_treatment_decisions row % may only be updated to set superseded_at (the FR-073 supersession stamp)', OLD.id;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.risk_id IS DISTINCT FROM OLD.risk_id
        OR NEW.strategy IS DISTINCT FROM OLD.strategy
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.deadline IS DISTINCT FROM OLD.deadline
        OR NEW.decided_by_user_id IS DISTINCT FROM OLD.decided_by_user_id
        OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
    THEN
        RAISE EXCEPTION 'risk_treatment_decisions row % is append-only: only superseded_at/superseded_by_id may change', OLD.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER risk_treatment_decisions_append_only
    BEFORE UPDATE OR DELETE ON "risk_treatment_decisions"
    FOR EACH ROW EXECUTE FUNCTION risk_treatment_decisions_prevent_overwrite();
