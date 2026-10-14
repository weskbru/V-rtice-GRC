-- 009-indicators-reports, Fase 1 (T001-T004) — schema-only foundation for
-- two new business-module entities (`IndicatorDefinition`,
-- `IndicatorMeasurement`, `ReportDefinition`; data-model.md §1-§2), plus
-- additive growth of two existing closed enums (`AuditEntityType`,
-- `CommentableEntityType`; data-model.md §5) so both new entities become
-- valid subjects for the shared Audit and Comment mechanisms (ADR-008:
-- "closed platform enums grow by reviewed migration"). Purely additive —
-- no existing table changes shape, no existing enum value is redefined or
-- removed.
--
-- `ActionOriginType += INDICATOR` is DELIBERATELY NOT part of this
-- migration (research.md D-5, CLAUDE.md §19.10) — deferred to Fase 6 (US4),
-- paired atomically, in its own migration, with `IndicatorActionOriginAccessor`
-- and the four methods `test/unit/action-model-convergence-guard.spec.ts`
-- requires. Same discipline `008-incidents-problems` already applied to the
-- same enum (`20260911030000_action_origin_type_add_incidents_problems`).
--
-- `AttachableEntityType` does NOT gain `INDICATOR`/`REPORT` (spec.md
-- FR-033): neither is attachable in this phase, only commentable
-- (`INDICATOR` only) — see the `CommentableEntityType` alteration below.
--
-- Neither `IndicatorDefinition` nor `IndicatorMeasurement` nor
-- `ReportDefinition` carries an `org_unit_id` column (research.md D-6/D-8,
-- data-model.md §7-§8) — deliberate, not an omission. See schema.prisma's
-- own section header above these models for the full reasoning.
--
-- SQL below is `prisma migrate diff --from-url <test db> --to-schema-
-- datamodel schema.prisma --script`-generated, hand-reviewed and pruned:
-- the raw diff also proposed thirteen statements unrelated to this
-- migration (dropping/recreating `control_assessments_org_unit_id_fkey`
-- and `organizational_units_path_pattern_idx` identically, dropping the
-- `updated_at` column default on five unrelated tables, dropping table
-- `vertice_config`, and renaming six foreign-key constraints on Compliance
-- tables) — pre-existing drift between the test database's actual state
-- and this repository's `schema.prisma`, already documented in
-- `docs/local-environment.md` and in `008-incidents-problems`'s own
-- foundation migration header, unrelated to Indicators/Reports and out of
-- this migration's scope. None of that is included below.

-- CreateEnum
CREATE TYPE "IndicatorMetricKey" AS ENUM ('RISK_TOTAL_BY_LEVEL', 'RISK_TREATMENT_OVERDUE_COUNT', 'CONTROL_INACTIVE_COUNT', 'COMPLIANCE_PERCENTAGE', 'AUDIT_ENGAGEMENT_OPEN_COUNT', 'FINDING_OPEN_COUNT_BY_SEVERITY', 'ASSET_INACTIVE_COUNT', 'PROCESS_INACTIVE_COUNT', 'ACTION_OVERDUE_COUNT', 'INCIDENT_OPEN_COUNT_BY_SEVERITY', 'PROBLEM_OPEN_COUNT_BY_SEVERITY');

-- CreateEnum
CREATE TYPE "IndicatorThresholdComparator" AS ENUM ('GTE', 'GT', 'LTE', 'LT');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'INDICATOR';
ALTER TYPE "AuditEntityType" ADD VALUE 'INDICATOR_MEASUREMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'REPORT';

-- AlterEnum
ALTER TYPE "CommentableEntityType" ADD VALUE 'INDICATOR';

-- CreateTable
CREATE TABLE "indicator_definitions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "metric_key" "IndicatorMetricKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "threshold_comparator" "IndicatorThresholdComparator",
    "threshold_value" DECIMAL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "indicator_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_measurements" (
    "id" UUID NOT NULL,
    "metric_key" "IndicatorMetricKey" NOT NULL,
    "value" DECIMAL,
    "value_by_bucket" JSONB,
    "breached" BOOLEAN NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computed_by_user_id" UUID NOT NULL,

    CONSTRAINT "indicator_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_definitions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric_keys" "IndicatorMetricKey"[] NOT NULL DEFAULT ARRAY[]::"IndicatorMetricKey"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "indicator_definitions_code_key" ON "indicator_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_definitions_metric_key_key" ON "indicator_definitions"("metric_key");

-- CreateIndex
CREATE INDEX "indicator_measurements_metric_key_computed_at_idx" ON "indicator_measurements"("metric_key", "computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_code_key" ON "report_definitions"("code");

-- AddForeignKey
ALTER TABLE "indicator_definitions" ADD CONSTRAINT "indicator_definitions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_definitions" ADD CONSTRAINT "indicator_definitions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_measurements" ADD CONSTRAINT "indicator_measurements_computed_by_user_id_fkey" FOREIGN KEY ("computed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_definitions" ADD CONSTRAINT "report_definitions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
