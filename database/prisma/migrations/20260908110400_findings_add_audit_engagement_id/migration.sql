-- T004/005-audit-findings — additive column on `findings` (data-model.md
-- §7, FR-007/FR-008): `audit_engagement_id`, nullable — `null` for every
-- achado manual (unchanged Fase 1 path); filled ONLY by
-- `POST /audits/{auditId}/findings`. No other column of `findings` changes
-- shape, nulidade or type (SC-007). SQL below is `prisma migrate diff`-
-- generated.

-- AlterTable
ALTER TABLE "findings" ADD COLUMN "audit_engagement_id" UUID;

-- CreateIndex
CREATE INDEX "findings_audit_engagement_id_idx" ON "findings"("audit_engagement_id");

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_audit_engagement_id_fkey" FOREIGN KEY ("audit_engagement_id") REFERENCES "audit_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
