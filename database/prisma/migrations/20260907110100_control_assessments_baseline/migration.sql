-- T002/003-controls-management — `control_assessments` (data-model.md §2):
-- the immutable effectiveness verification. Deliberately has NO
-- `updated_at` column — a new assessment succeeds the previous one;
-- nothing here is ever revised in place (FR-010). `approval_id` is the
-- attestation cycle, a nullable FK into the existing generic `approvals`
-- table (data-model.md §4, `ApprovableEntityType.CONTROL_ASSESSMENT`) —
-- no bespoke approval table is introduced.

-- CreateTable
CREATE TABLE "control_assessments" (
    "id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "assessed_on" DATE NOT NULL,
    "assessor_user_id" UUID NOT NULL,
    "result" "ControlAssessmentResult" NOT NULL,
    "conclusion" TEXT NOT NULL,
    "approval_id" UUID,
    "attested_at" TIMESTAMPTZ(6),
    "attested_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "control_assessments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "control_assessments" ADD CONSTRAINT "control_assessments_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_assessments" ADD CONSTRAINT "control_assessments_assessor_user_id_fkey" FOREIGN KEY ("assessor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_assessments" ADD CONSTRAINT "control_assessments_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_assessments" ADD CONSTRAINT "control_assessments_attested_by_user_id_fkey" FOREIGN KEY ("attested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex — the exact ordering `ControlEffectivenessService` walks
-- (most recent attested assessment first, data-model.md §2) and the
-- history view renders.
CREATE INDEX "control_assessments_control_id_assessed_on_created_at_idx" ON "control_assessments"("control_id", "assessed_on" DESC, "created_at" DESC);
