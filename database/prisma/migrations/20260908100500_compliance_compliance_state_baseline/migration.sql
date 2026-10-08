-- T005/004-compliance-management — `requirement_compliance_audit_marks`
-- (data-model.md §7, research.md D-11): NOT the compliance-state column
-- FR-017/§19.7 forbid. It stores only the last OBSERVED value, one row per
-- requirement, written exclusively as the side effect of the
-- observation-time comparison that decides whether to emit a
-- `REQUIREMENT_COMPLIANCE_STATE` audit event (User Story 3, out of this
-- workstream's own scope — schema-only here). No operation in this API
-- ever reads this table to answer "what is the current state" — that is
-- always `RequirementComplianceService`, recomputed from source data.

-- CreateEnum
CREATE TYPE "RequirementComplianceState" AS ENUM ('NOT_APPLICABLE', 'NOT_MET', 'NOT_PROVEN', 'PARTIALLY_MET', 'COMPLIANT');

-- CreateTable
CREATE TABLE "requirement_compliance_audit_marks" (
    "requirement_id" UUID NOT NULL,
    "last_audited_state" "RequirementComplianceState" NOT NULL,
    "last_audited_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "requirement_compliance_audit_marks_pkey" PRIMARY KEY ("requirement_id")
);

-- AddForeignKey
ALTER TABLE "requirement_compliance_audit_marks" ADD CONSTRAINT "requirement_compliance_audit_marks_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
