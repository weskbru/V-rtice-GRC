-- T001/003-controls-management — additive growth of the `controls` table,
-- promoting the Fase 1 minimal registry to the Controls Management domain
-- (data-model.md §1, D-1, ADR-016, ADR-017). `code`, `name`, `description`,
-- `org_unit_id`, `is_active`, `created_at`, `updated_at` are UNCHANGED —
-- no existing column changes type, name or nullability, and no existing
-- row is rewritten. `risk_control_links` is not touched at all (data-model
-- §6), and `modules/risk`'s own reading of `controls.is_active` keeps
-- identical semantics (SC-006).
--
-- Every new column is nullable or defaulted, so every control row that
-- exists today gets `status = 'DRAFT'` and every other new column `NULL`
-- (FR-003: incomplete, never invalid).

-- CreateEnum
CREATE TYPE "ControlStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ControlNature" AS ENUM ('MANUAL', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "ControlType" AS ENUM ('PREVENTIVE', 'DETECTIVE', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "ControlFrequency" AS ENUM ('CONTINUOUS', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ControlAssessmentResult" AS ENUM ('EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE');

-- AlterTable
ALTER TABLE "controls"
  ADD COLUMN "owner_user_id" UUID,
  ADD COLUMN "nature" "ControlNature",
  ADD COLUMN "control_type" "ControlType",
  ADD COLUMN "frequency" "ControlFrequency",
  ADD COLUMN "status" "ControlStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "retired_at" TIMESTAMPTZ(6),
  ADD COLUMN "retired_by_user_id" UUID,
  ADD COLUMN "retirement_reason" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "controls" ADD CONSTRAINT "controls_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controls" ADD CONSTRAINT "controls_retired_by_user_id_fkey" FOREIGN KEY ("retired_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex — the catalog's own scope+status filter (data-model.md §9:
-- "toda leitura usa o ScopedRepository com escopo obrigatório").
CREATE INDEX "controls_org_unit_id_status_idx" ON "controls"("org_unit_id", "status");

-- CreateIndex
CREATE INDEX "controls_owner_user_id_idx" ON "controls"("owner_user_id");
