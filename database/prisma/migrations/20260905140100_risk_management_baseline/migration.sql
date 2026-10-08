-- T083/T084 — Risk Management baseline: reference data (RiskCategory/
-- RiskType/RiskOrigin), the risk record itself (Risk/RiskCause/
-- RiskConsequence) and the per-year code counter (RiskCodeSequence).
-- Spec: specs/001-grc-platform-foundation/data-model.md §7-§8.
--
-- Hand-written (not `prisma migrate dev` output — see schema.prisma's
-- header and docs/local-environment.md: this project never runs
-- `migrate dev`), but its DDL corresponds 1:1 to the models added to
-- schema.prisma in this same change, with one deliberate addition Prisma's
-- schema language cannot express: the GIN trigram search index at the
-- bottom (see schema.prisma's `Risk` model doc comment for why).

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('DRAFT', 'IDENTIFIED', 'ASSESSED', 'UNDER_TREATMENT', 'UNDER_REVIEW', 'ACCEPTED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "risk_categories" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risk_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risk_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_origins" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risk_origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_code_sequences" (
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "risk_code_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID,
    "type_id" UUID,
    "origin_id" UUID,
    "org_unit_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "responsible_user_id" UUID,
    "status" "RiskStatus" NOT NULL DEFAULT 'DRAFT',
    "current_assessment_id" UUID,
    "current_treatment_id" UUID,
    "pending_approval_id" UUID,
    "inherent_score" INTEGER,
    "inherent_level" "RiskLevel",
    "residual_score" INTEGER,
    "residual_level" "RiskLevel",
    "identified_on" DATE NOT NULL,
    "last_assessed_on" DATE,
    "next_review_on" DATE,
    "version" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_causes" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "risk_causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_consequences" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "risk_consequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "risk_categories_code_key" ON "risk_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "risk_types_code_key" ON "risk_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "risk_origins_code_key" ON "risk_origins"("code");

-- CreateIndex
CREATE UNIQUE INDEX "risks_code_key" ON "risks"("code");

-- CreateIndex
CREATE INDEX "risks_org_unit_id_status_idx" ON "risks"("org_unit_id", "status");

-- CreateIndex
CREATE INDEX "risks_org_unit_id_residual_level_idx" ON "risks"("org_unit_id", "residual_level");

-- CreateIndex
CREATE INDEX "risks_org_unit_id_inherent_level_idx" ON "risks"("org_unit_id", "inherent_level");

-- CreateIndex
CREATE INDEX "risks_org_unit_id_next_review_on_idx" ON "risks"("org_unit_id", "next_review_on");

-- CreateIndex
CREATE INDEX "risks_owner_user_id_idx" ON "risks"("owner_user_id");

-- CreateIndex
CREATE INDEX "risks_category_id_idx" ON "risks"("category_id");

-- CreateIndex
CREATE INDEX "risk_causes_risk_id_idx" ON "risk_causes"("risk_id");

-- CreateIndex
CREATE INDEX "risk_consequences_risk_id_idx" ON "risk_consequences"("risk_id");

-- data-model.md §8: "a GIN trigram index over
-- `code || ' ' || title || ' ' || description`" for register text search
-- (FR-089). Prisma's schema language cannot declare an expression index —
-- this is the one place `risks`' real schema intentionally diverges from
-- what schema.prisma alone can express, exactly like `audit_event`'s
-- partitioning (see that model's header comment). `gin_trgm_ops` is
-- available because the `pg_trgm` extension is already created by the
-- baseline migration (`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`).
CREATE INDEX "risks_search_trgm_idx" ON "risks" USING GIN ((("code" || ' ' || "title" || ' ' || "description")) gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "risk_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "risk_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_origin_id_fkey" FOREIGN KEY ("origin_id") REFERENCES "risk_origins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_causes" ADD CONSTRAINT "risk_causes_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_consequences" ADD CONSTRAINT "risk_consequences_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
