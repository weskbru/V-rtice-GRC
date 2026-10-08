-- T004/004-compliance-management — `requirement_applicability_declarations`
-- (data-model.md §6, research.md D-7): a not-applicable declaration is a
-- succession of events, never a rewritten flag — the same partial-unique-
-- index technique as `requirement_control_links`/`control_process_links`.
-- Schema-only in this migration — the domain/application/presentation code
-- that writes this table is User Story 3 (out of this workstream's own
-- scope).

-- CreateTable
CREATE TABLE "requirement_applicability_declarations" (
    "id" UUID NOT NULL,
    "requirement_id" UUID NOT NULL,
    "justification" TEXT NOT NULL,
    "declared_at" TIMESTAMPTZ(6) NOT NULL,
    "declared_by_user_id" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_user_id" UUID,

    CONSTRAINT "requirement_applicability_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirement_applicability_declarations_requirement_id_idx" ON "requirement_applicability_declarations"("requirement_id");

-- data-model.md §6: "Unicidade parcial (requirement_id) WHERE revoked_at
-- IS NULL — no máximo uma declaração vigente por requisito".
CREATE UNIQUE INDEX "requirement_applicability_declarations_requirement_id_active_key" ON "requirement_applicability_declarations"("requirement_id") WHERE "revoked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "requirement_applicability_declarations" ADD CONSTRAINT "requirement_applicability_declarations_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_applicability_declarations" ADD CONSTRAINT "requirement_applicability_declarations_declared_by_fkey" FOREIGN KEY ("declared_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_applicability_declarations" ADD CONSTRAINT "requirement_applicability_declarations_revoked_by_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
