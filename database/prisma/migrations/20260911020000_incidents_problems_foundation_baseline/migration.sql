-- 008-incidents-problems, foundation — two business-module entities
-- (`incidents`, `problems`) and five link tables (data-model.md §1-§2),
-- plus additive growth of four existing closed enums
-- (AttachableEntityType, AuditEntityType, CommentableEntityType,
-- EvidenceSubjectType) so both domains become valid subjects for the
-- shared Evidence, Attachment, Comment and Audit mechanisms (ADR-008:
-- "closed platform enums grow by reviewed migration"). Purely additive —
-- no existing table changes shape, no existing enum value is redefined or
-- removed.
--
-- `ActionOriginType` is DELIBERATELY NOT extended here, unlike an earlier
-- revision of this file. `test/unit/action-model-convergence-guard.spec.ts`
-- enforces a 1:1 rule between every member and a real, four-method
-- `ActionOriginAccessor` (one method needs a scope-filtered repository
-- query) — building that untested at this hour was the coordinator's own
-- named risk for the Incident<->Problem link, applied here too (spec.md
-- FR-016, research.md D-2). Deferred to Fase 6 (US4), together with the
-- accessor. This means neither `Incident` nor `Problem` can be an
-- `Action`'s origin until that migration lands — not a footnote, most of
-- what this consumption decision was for. An EARLIER revision of this
-- migration DID extend `ActionOriginType`, and — by the connection-
-- variable mistake `docs/local-environment.md` D-18 records — was applied
-- to both `pharos_grc` and `pharos_grc_test` before being corrected here.
-- Both databases now carry an inert, undeclared `ActionOriginType` value
-- that PostgreSQL cannot un-add (`docs/local-environment.md` D-19). This
-- file, as committed, has never added it — a fresh database has no drift.
--
-- SQL below is `prisma migrate diff --from-url <test db> --to-schema-
-- datamodel schema.prisma --script`-generated, hand-reviewed and pruned:
-- the raw diff also proposed six statements unrelated to this migration
-- (dropping/recreating `control_assessments_org_unit_id_fkey` and
-- `organizational_units_path_pattern_idx` identically, dropping the
-- `updated_at` column default on five unrelated tables, dropping table
-- `pharos_config`, and renaming six foreign-key constraints on Compliance
-- tables) — pre-existing drift between the test database's actual state
-- and this repository's `schema.prisma`, unrelated to Incidents/Problems
-- and out of this migration's scope. None of that is included below;
-- flagged separately for whoever owns those tables next, the same
-- discipline this schema's own header already asks of `audit_event`.
--
-- Two hand-written partial unique indexes appear below that `prisma
-- migrate diff` did not propose, because they are not expressible in
-- Prisma's schema language — same technique every other link table in
-- this codebase already uses (`finding_risk_links_finding_id_risk_id_
-- active_key`, `requirement_control_links_requirement_id_control_id_
-- active_key`): "(originId, targetId) WHERE unlinked_at IS NULL", so a
-- withdrawn link never blocks re-linking the same pair.

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProblemSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('OPEN', 'IN_ANALYSIS', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AttachableEntityType" ADD VALUE 'INCIDENT';
ALTER TYPE "AttachableEntityType" ADD VALUE 'PROBLEM';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'INCIDENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'PROBLEM';
ALTER TYPE "AuditEntityType" ADD VALUE 'INCIDENT_RISK_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'INCIDENT_ASSET_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'INCIDENT_PROCESS_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'PROBLEM_RISK_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'PROBLEM_INCIDENT_LINK';

-- AlterEnum
ALTER TYPE "CommentableEntityType" ADD VALUE 'INCIDENT';
ALTER TYPE "CommentableEntityType" ADD VALUE 'PROBLEM';

-- AlterEnum
ALTER TYPE "EvidenceSubjectType" ADD VALUE 'INCIDENT';
ALTER TYPE "EvidenceSubjectType" ADD VALUE 'PROBLEM';

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "reported_by_user_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "reported_on" DATE NOT NULL,
    "resolution_summary" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_user_id" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by_user_id" UUID,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ProblemSeverity" NOT NULL,
    "status" "ProblemStatus" NOT NULL DEFAULT 'OPEN',
    "owner_user_id" UUID NOT NULL,
    "identified_on" DATE NOT NULL,
    "root_cause" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_user_id" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by_user_id" UUID,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_risk_links" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "incident_risk_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_asset_links" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "incident_asset_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_process_links" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "incident_process_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_risk_links" (
    "id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "problem_risk_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_incident_links" (
    "id" UUID NOT NULL,
    "problem_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "problem_incident_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incidents_code_key" ON "incidents"("code");

-- CreateIndex
CREATE INDEX "incidents_org_unit_id_idx" ON "incidents"("org_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "problems_code_key" ON "problems"("code");

-- CreateIndex
CREATE INDEX "problems_org_unit_id_idx" ON "problems"("org_unit_id");

-- CreateIndex
CREATE INDEX "incident_risk_links_incident_id_unlinked_at_idx" ON "incident_risk_links"("incident_id", "unlinked_at");

-- data-model.md L1: partial unique — impedes a duplicate CURRENT link
-- while allowing re-linking after withdrawal. Hand-written: not
-- expressible in Prisma's schema language.
CREATE UNIQUE INDEX "incident_risk_links_incident_id_risk_id_active_key" ON "incident_risk_links"("incident_id", "risk_id") WHERE "unlinked_at" IS NULL;

-- CreateIndex
CREATE INDEX "incident_asset_links_incident_id_unlinked_at_idx" ON "incident_asset_links"("incident_id", "unlinked_at");

-- Hand-written, same technique as above.
CREATE UNIQUE INDEX "incident_asset_links_incident_id_asset_id_active_key" ON "incident_asset_links"("incident_id", "asset_id") WHERE "unlinked_at" IS NULL;

-- CreateIndex
CREATE INDEX "incident_process_links_incident_id_unlinked_at_idx" ON "incident_process_links"("incident_id", "unlinked_at");

-- Hand-written, same technique as above.
CREATE UNIQUE INDEX "incident_process_links_incident_id_process_id_active_key" ON "incident_process_links"("incident_id", "process_id") WHERE "unlinked_at" IS NULL;

-- CreateIndex
CREATE INDEX "problem_risk_links_problem_id_unlinked_at_idx" ON "problem_risk_links"("problem_id", "unlinked_at");

-- Hand-written, same technique as above.
CREATE UNIQUE INDEX "problem_risk_links_problem_id_risk_id_active_key" ON "problem_risk_links"("problem_id", "risk_id") WHERE "unlinked_at" IS NULL;

-- CreateIndex
CREATE INDEX "problem_incident_links_problem_id_unlinked_at_idx" ON "problem_incident_links"("problem_id", "unlinked_at");

-- CreateIndex
CREATE INDEX "problem_incident_links_incident_id_unlinked_at_idx" ON "problem_incident_links"("incident_id", "unlinked_at");

-- data-model.md L1/D-14: partial unique on the N:M link the coordinator
-- decided (spec.md "Decisões do coordenador"). Hand-written, same
-- technique as above.
CREATE UNIQUE INDEX "problem_incident_links_problem_id_incident_id_active_key" ON "problem_incident_links"("problem_id", "incident_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_risk_links" ADD CONSTRAINT "incident_risk_links_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_risk_links" ADD CONSTRAINT "incident_risk_links_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_risk_links" ADD CONSTRAINT "incident_risk_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_risk_links" ADD CONSTRAINT "incident_risk_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_asset_links" ADD CONSTRAINT "incident_asset_links_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_asset_links" ADD CONSTRAINT "incident_asset_links_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_asset_links" ADD CONSTRAINT "incident_asset_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_asset_links" ADD CONSTRAINT "incident_asset_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_process_links" ADD CONSTRAINT "incident_process_links_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_process_links" ADD CONSTRAINT "incident_process_links_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_process_links" ADD CONSTRAINT "incident_process_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_process_links" ADD CONSTRAINT "incident_process_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_risk_links" ADD CONSTRAINT "problem_risk_links_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_risk_links" ADD CONSTRAINT "problem_risk_links_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_risk_links" ADD CONSTRAINT "problem_risk_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_risk_links" ADD CONSTRAINT "problem_risk_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_incident_links" ADD CONSTRAINT "problem_incident_links_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_incident_links" ADD CONSTRAINT "problem_incident_links_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_incident_links" ADD CONSTRAINT "problem_incident_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_incident_links" ADD CONSTRAINT "problem_incident_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
