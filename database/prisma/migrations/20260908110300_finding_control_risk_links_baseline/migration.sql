-- T003/005-audit-findings — `finding_control_links` and `finding_risk_links`
-- (data-model.md §5-§6), the two `Finding` relationships Phase 1 deferred
-- (ADR-020 parts 1/2). Same shape as `RiskControlLink`. Purely additive —
-- schema-only in this migration; the domain/application/presentation code
-- that writes these tables is Fase 5/User Story 3 (out of this task's own
-- scope). SQL below is `prisma migrate diff`-generated, plus two
-- hand-written partial unique indexes Prisma's schema language cannot
-- express (documented drift, same pattern as
-- `requirement_control_links_requirement_id_control_id_active_key`).

-- CreateTable
CREATE TABLE "finding_control_links" (
    "id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "finding_control_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finding_control_links_finding_id_unlinked_at_idx" ON "finding_control_links"("finding_id", "unlinked_at");

-- data-model.md §5: "Índice parcial único (finding_id, control_id) WHERE
-- unlinked_at IS NULL" — impedes a duplicate CURRENT link while allowing
-- re-linking after withdrawal, the same technique
-- `requirement_control_links_requirement_id_control_id_active_key`
-- already uses. Hand-written: Prisma's schema language has no partial-
-- index syntax.
CREATE UNIQUE INDEX "finding_control_links_finding_id_control_id_active_key" ON "finding_control_links"("finding_id", "control_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "finding_control_links" ADD CONSTRAINT "finding_control_links_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_control_links" ADD CONSTRAINT "finding_control_links_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_control_links" ADD CONSTRAINT "finding_control_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_control_links" ADD CONSTRAINT "finding_control_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "finding_risk_links" (
    "id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "finding_risk_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finding_risk_links_finding_id_unlinked_at_idx" ON "finding_risk_links"("finding_id", "unlinked_at");

-- data-model.md §6: same partial-unique technique as above, against
-- (finding_id, risk_id).
CREATE UNIQUE INDEX "finding_risk_links_finding_id_risk_id_active_key" ON "finding_risk_links"("finding_id", "risk_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "finding_risk_links" ADD CONSTRAINT "finding_risk_links_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_risk_links" ADD CONSTRAINT "finding_risk_links_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_risk_links" ADD CONSTRAINT "finding_risk_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_risk_links" ADD CONSTRAINT "finding_risk_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
