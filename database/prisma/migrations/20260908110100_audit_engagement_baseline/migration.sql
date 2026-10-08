-- T001/005-audit-findings — `AuditEngagementStatus` and `audit_engagements`
-- (data-model.md §1), amended at the analysis gate to include the fourth
-- state `CANCELLED` and its `cancelled_at`/`cancelled_by_user_id`/
-- `cancellation_justification` columns (FR-004a — the discard path that
-- keeps an engagement opened by mistake, or abandoned before it has scope,
-- from being stuck forever; see the model's own doc comment in
-- schema.prisma). Purely additive — no existing table changes shape.
-- SQL below is `prisma migrate diff`-generated (naming matches the schema
-- exactly), split out of the full-feature diff into this table's own
-- migration.

-- CreateEnum
CREATE TYPE "AuditEngagementStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "audit_engagements" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "lead_auditor_user_id" UUID NOT NULL,
    "status" "AuditEngagementStatus" NOT NULL DEFAULT 'PLANNING',
    "started_at" TIMESTAMPTZ(6),
    "started_by_user_id" UUID,
    "completed_at" TIMESTAMPTZ(6),
    "completed_by_user_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_user_id" UUID,
    "cancellation_justification" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "audit_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_engagements_code_key" ON "audit_engagements"("code");

-- CreateIndex — data-model.md §1's own "meus engajamentos em execução".
CREATE INDEX "audit_engagements_org_unit_id_status_idx" ON "audit_engagements"("org_unit_id", "status");

-- CreateIndex
CREATE INDEX "audit_engagements_lead_auditor_user_id_idx" ON "audit_engagements"("lead_auditor_user_id");

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_lead_auditor_user_id_fkey" FOREIGN KEY ("lead_auditor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_started_by_user_id_fkey" FOREIGN KEY ("started_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
