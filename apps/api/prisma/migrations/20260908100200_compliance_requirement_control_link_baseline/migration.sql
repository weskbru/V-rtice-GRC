-- T002/004-compliance-management — `requirement_control_links`, the
-- explicit N:M mapping between a requirement and the controls that satisfy
-- it (data-model.md §4, ADR-017, ADR-020). Same shape and partial-unique-
-- index technique as `control_process_links`/`control_asset_links`
-- (`20260907110200_control_process_asset_links_baseline`) — hand-written
-- because Prisma's schema language has no partial-index syntax.
--
-- Real FK to `controls` (ADR-020 part 2): integrity at the database level,
-- while the module boundary (no `modules/compliance` import of
-- `modules/controls`) stays a code-level concept, verified by
-- `compliance-controls-risk-module-boundary.spec.ts` (research.md D-9,
-- D-10).
--
-- Schema-only in this migration: the domain/application/presentation code
-- that writes this table is User Story 2 (out of this workstream's own
-- scope) — this table exists now so Fase 1 ships every table the feature
-- needs in one reviewed pass (tasks.md Fase 1).

-- CreateTable
CREATE TABLE "requirement_control_links" (
    "id" UUID NOT NULL,
    "requirement_id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "requirement_control_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — the compliance-state batch read (data-model.md §4: "é o
-- que o cálculo de conformidade em lote percorre").
CREATE INDEX "requirement_control_links_control_id_active_idx" ON "requirement_control_links"("control_id") WHERE "unlinked_at" IS NULL;

-- CreateIndex
CREATE INDEX "requirement_control_links_requirement_id_idx" ON "requirement_control_links"("requirement_id");

-- data-model.md §4: "Unicidade parcial (requirement_id, control_id) WHERE
-- unlinked_at IS NULL" — impedes a duplicate CURRENT link while allowing
-- re-linking after withdrawal, the same technique
-- `control_process_links_control_id_process_id_active_key` already uses.
CREATE UNIQUE INDEX "requirement_control_links_requirement_id_control_id_active_key" ON "requirement_control_links"("requirement_id", "control_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "requirement_control_links" ADD CONSTRAINT "requirement_control_links_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_control_links" ADD CONSTRAINT "requirement_control_links_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_control_links" ADD CONSTRAINT "requirement_control_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_control_links" ADD CONSTRAINT "requirement_control_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
