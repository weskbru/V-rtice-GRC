-- T003/003-controls-management — `control_process_links`/
-- `control_asset_links` (data-model.md §5, ADR-020 part 1/2): explicit,
-- named links from a control to the process/asset it operates on, each
-- with real referential integrity (`onDelete: Restrict`). Same shape and
-- the same partial-unique-index technique as `risk_process_links`/
-- `risk_asset_links`
-- (`20260905160100_risk_treatment_and_relationships_baseline`) — hand-
-- written because Prisma's schema language has no partial-index syntax
-- (same documented drift pattern as that migration and
-- `risk_methodologies_one_active_idx`).

-- CreateTable
CREATE TABLE "control_process_links" (
    "id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "control_process_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_asset_links" (
    "id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "control_asset_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "control_process_links_control_id_idx" ON "control_process_links"("control_id");

-- CreateIndex
CREATE INDEX "control_asset_links_control_id_idx" ON "control_asset_links"("control_id");

-- data-model.md §5: "Unicidade parcial (control_id, process_id) WHERE
-- unlinked_at IS NULL — mesma técnica de RiskControlLink": impedes a
-- duplicate CURRENT link while allowing re-linking after withdrawal — the
-- same real, race-free database guarantee
-- `risk_control_links_risk_id_control_id_active_key` gives the risk side.
CREATE UNIQUE INDEX "control_process_links_control_id_process_id_active_key" ON "control_process_links"("control_id", "process_id") WHERE "unlinked_at" IS NULL;

-- Same rationale as above, against `control_asset_links`.
CREATE UNIQUE INDEX "control_asset_links_control_id_asset_id_active_key" ON "control_asset_links"("control_id", "asset_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "control_process_links" ADD CONSTRAINT "control_process_links_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_process_links" ADD CONSTRAINT "control_process_links_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_process_links" ADD CONSTRAINT "control_process_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_process_links" ADD CONSTRAINT "control_process_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_asset_links" ADD CONSTRAINT "control_asset_links_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_asset_links" ADD CONSTRAINT "control_asset_links_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_asset_links" ADD CONSTRAINT "control_asset_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_asset_links" ADD CONSTRAINT "control_asset_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
