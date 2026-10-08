-- T001/004-compliance-management — the normative library's root three
-- tables (data-model.md §1-§3, ADR-017): `frameworks`, `framework_versions`,
-- `requirements`. Purely additive — no existing table changes shape.
--
-- No `org_unit_id` on any of the three (research.md D-2): platform-wide
-- catalog, gated only by `compliance:*` permission, the same regime
-- `roles`/`permissions` already use. `onDelete: Restrict` on every FK, the
-- same convention every other GRC table in this schema follows.

-- CreateEnum
CREATE TYPE "FrameworkOrigin" AS ENUM ('EXTERNAL_STANDARD', 'INTERNAL_POLICY');

-- CreateEnum
CREATE TYPE "FrameworkVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "frameworks" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "origin" "FrameworkOrigin" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "frameworks_code_key" ON "frameworks"("code");

-- CreateTable
CREATE TABLE "framework_versions" (
    "id" UUID NOT NULL,
    "framework_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "status" "FrameworkVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "published_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "framework_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — the version-lookup path (`GET .../versions`).
CREATE INDEX "framework_versions_framework_id_idx" ON "framework_versions"("framework_id");

-- CreateIndex — `label` unique per framework (research.md D-14).
CREATE UNIQUE INDEX "framework_versions_framework_id_label_key" ON "framework_versions"("framework_id", "label");

-- AddForeignKey
ALTER TABLE "framework_versions" ADD CONSTRAINT "framework_versions_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "frameworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "framework_versions" ADD CONSTRAINT "framework_versions_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "requirements" (
    "id" UUID NOT NULL,
    "framework_version_id" UUID NOT NULL,
    "external_ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — not unique (data-model.md §3: two versions of different
-- norms may coincide in clause number by accident; FR-007 forbids
-- deduplication, never mandates uniqueness).
CREATE INDEX "requirements_framework_version_id_external_ref_idx" ON "requirements"("framework_version_id", "external_ref");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_framework_version_id_fkey" FOREIGN KEY ("framework_version_id") REFERENCES "framework_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
