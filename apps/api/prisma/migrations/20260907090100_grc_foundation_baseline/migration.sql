-- T005/T006/T007/002-shared-grc-foundation — GRC Shared Kernel baseline:
-- `Evidence`, `EvidenceLink`, `Action`, `Finding`, `GrcCodeSequence`
-- (data-model.md §2-§5, ADR-016, ADR-018), the eleven supporting enums, and
-- the additive `risk_treatment_actions.action_id` column (data-model.md §7,
-- R-003). No existing column is removed or renamed.
--
-- Hand-written (never `prisma migrate dev` against a real database — see
-- schema.prisma's own header and docs/local-environment.md D-1/D-7),
-- corresponding 1:1 to the models added to schema.prisma in this same
-- change, with the two additions Prisma's schema language cannot express:
--
--   1. The CHECK for Invariant E1 (data-model.md §2: "ao menos um de
--      fileId, externalUrl, observation preenchido") — a real database
--      backstop, not merely a domain-level check, on `evidence` below.
--   2. The partial unique index for Invariant L1 (data-model.md §3: "o
--      mesmo par não pode ter dois vínculos ativos") on `evidence_links`,
--      the same documented drift pattern already established for
--      `risk_methodologies_one_active_idx`
--      (`20260905150100_risk_assessment_methodology_baseline`) and the
--      three risk relationship link tables' partial unique indexes
--      (`20260905160100_risk_treatment_and_relationships_baseline`).
--
-- Every other invariant in data-model.md §2-§5 (E2, E3, A1-A3, F1-F4) is
-- domain-enforced, not a database CHECK — see schema.prisma's own section
-- header comment for why (several span more than one table, e.g. F2's
-- segregation of duties, which a single-table CHECK cannot express at all;
-- others, like A3, would forbid a case the domain must accept).

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('DOCUMENT', 'SCREENSHOT', 'SYSTEM_LOG', 'ATTESTATION', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('MANUAL_UPLOAD', 'SYSTEM_EXPORT', 'THIRD_PARTY', 'INSPECTION');

-- CreateEnum — deliberately ONLY two members; see schema.prisma's own
-- comment on `EvidenceStatus` for why `EXPIRED` is not one of them.
CREATE TYPE "EvidenceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EvidenceSubjectType" AS ENUM ('RISK', 'RISK_TREATMENT_DECISION', 'FINDING', 'ACTION');

-- CreateEnum
CREATE TYPE "ActionOriginType" AS ENUM ('RISK_TREATMENT', 'FINDING');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FindingOrigin" AS ENUM ('INTERNAL_ASSESSMENT', 'CONTROL_TESTING', 'MANAGEMENT_REVIEW');

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('NONCONFORMITY', 'CONTROL_DEFICIENCY', 'OBSERVATION', 'IMPROVEMENT_OPPORTUNITY');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FindingPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'IN_REMEDIATION', 'CLOSED', 'ARCHIVED');

-- AlterTable — data-model.md §7/R-003: additive-only, nullable, no existing
-- column touched. Filled by the risk module's treatment-action use case
-- during the double-write convergence window (out of this task's scope).
ALTER TABLE "risk_treatment_actions" ADD COLUMN     "action_id" UUID;

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EvidenceType" NOT NULL,
    "source" "EvidenceSource" NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "collected_on" DATE NOT NULL,
    "valid_until" DATE,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "file_id" UUID,
    "external_url" TEXT,
    "observation" TEXT,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_links" (
    "id" UUID NOT NULL,
    "evidence_id" UUID NOT NULL,
    "subject_type" "EvidenceSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,
    "note" TEXT,

    CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "origin_type" "ActionOriginType" NOT NULL,
    "origin_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsible_user_id" UUID NOT NULL,
    "due_on" DATE NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "completed_at" TIMESTAMPTZ(6),
    "completed_by_user_id" UUID,
    "reopened_at" TIMESTAMPTZ(6),
    "reopened_by_user_id" UUID,
    "reopen_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT,
    "category" "FindingCategory" NOT NULL,
    "origin" "FindingOrigin" NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "priority" "FindingPriority" NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "identified_on" DATE NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMPTZ(6),
    "closed_by_user_id" UUID,
    "closure_justification" TEXT,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable — atomic per-year counter backing EVD-/ACT-/FND- code
-- allocation (schema.prisma's own comment on `GrcCodeSequence`), the same
-- concurrency idiom `risk_code_sequences` already establishes.
CREATE TABLE "grc_code_sequences" (
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grc_code_sequences_pkey" PRIMARY KEY ("prefix","year")
);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_code_key" ON "evidence"("code");

-- CreateIndex
CREATE INDEX "evidence_org_unit_id_status_idx" ON "evidence"("org_unit_id", "status");

-- CreateIndex
CREATE INDEX "evidence_valid_until_status_idx" ON "evidence"("valid_until", "status");

-- CreateIndex
CREATE INDEX "evidence_owner_user_id_status_idx" ON "evidence"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "evidence_links_subject_type_subject_id_unlinked_at_idx" ON "evidence_links"("subject_type", "subject_id", "unlinked_at");

-- CreateIndex
CREATE INDEX "evidence_links_evidence_id_unlinked_at_idx" ON "evidence_links"("evidence_id", "unlinked_at");

-- CreateIndex
CREATE UNIQUE INDEX "actions_code_key" ON "actions"("code");

-- CreateIndex
CREATE INDEX "actions_responsible_user_id_status_due_on_idx" ON "actions"("responsible_user_id", "status", "due_on");

-- CreateIndex
CREATE INDEX "actions_origin_type_origin_id_idx" ON "actions"("origin_type", "origin_id");

-- CreateIndex
CREATE INDEX "actions_org_unit_id_status_idx" ON "actions"("org_unit_id", "status");

-- CreateIndex
CREATE INDEX "actions_due_on_status_idx" ON "actions"("due_on", "status");

-- CreateIndex
CREATE UNIQUE INDEX "findings_code_key" ON "findings"("code");

-- CreateIndex
CREATE INDEX "findings_org_unit_id_status_idx" ON "findings"("org_unit_id", "status");

-- CreateIndex
CREATE INDEX "findings_severity_status_idx" ON "findings"("severity", "status");

-- CreateIndex
CREATE INDEX "findings_owner_user_id_status_idx" ON "findings"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "findings_status_identified_on_idx" ON "findings"("status", "identified_on");

-- CreateIndex — Invariant L1 (data-model.md §3): the same
-- (evidenceId, subjectType, subjectId) triple may not have two ACTIVE links
-- at once, though it may have a full history of link/unlink cycles.
-- Prisma's schema language has no partial-index syntax (as of this Prisma
-- version), so this is hand-written — see this migration's own header for
-- the precedent. This is what makes "linking an already-linked
-- (evidence, subject) pair returns 409" (linkEvidence,
-- contracts/grc-foundation.openapi.yaml) a real database guarantee, not
-- merely an application-level check a race could slip past.
CREATE UNIQUE INDEX "evidence_links_evidence_id_subject_type_subject_id_active_key" ON "evidence_links"("evidence_id", "subject_type", "subject_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "risk_treatment_actions" ADD CONSTRAINT "risk_treatment_actions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — see schema.prisma's own header comment on `Evidence.fileId`
-- for why this points at `attachments`, the closest existing "already
-- stored file" infrastructure, rather than a standalone `File` table.
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_archived_by_user_id_fkey" FOREIGN KEY ("archived_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_reopened_by_user_id_fkey" FOREIGN KEY ("reopened_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_archived_by_user_id_fkey" FOREIGN KEY ("archived_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariant E1 (data-model.md §2, FR-002): at least one of file_id,
-- external_url, observation must be non-null. A real database backstop —
-- the domain also enforces this (Evidence entity, a later task's scope),
-- but the same "the database is the last line" reasoning already applied
-- to `approvals_decided_by_requester_check`
-- (`20260905170100_risk_lifecycle_and_approvals_baseline`) applies here.
ALTER TABLE "evidence"
    ADD CONSTRAINT "evidence_has_substance_check"
    CHECK ("file_id" IS NOT NULL OR "external_url" IS NOT NULL OR "observation" IS NOT NULL);
