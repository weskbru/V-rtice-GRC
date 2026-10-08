-- T002/005-audit-findings — `audit_scope_framework_versions`,
-- `audit_scope_requirements` and `audit_scope_controls` (data-model.md
-- §2-§4). Each has a plain unique index (not partial) — none of the three
-- has an `unlinked_at` column at all (research.md D-12: no removal
-- operation for engagement scope in this fase), so an ordinary unique
-- constraint already expresses "the same target is never added twice".
-- Purely additive. SQL below is `prisma migrate diff`-generated.

-- CreateTable
CREATE TABLE "audit_scope_framework_versions" (
    "id" UUID NOT NULL,
    "audit_engagement_id" UUID NOT NULL,
    "framework_version_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "linked_by_user_id" UUID NOT NULL,

    CONSTRAINT "audit_scope_framework_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_scope_framework_versions_audit_engagement_id_idx" ON "audit_scope_framework_versions"("audit_engagement_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_scope_framework_versions_audit_engagement_id_framewor_key" ON "audit_scope_framework_versions"("audit_engagement_id", "framework_version_id");

-- AddForeignKey
ALTER TABLE "audit_scope_framework_versions" ADD CONSTRAINT "audit_scope_framework_versions_audit_engagement_id_fkey" FOREIGN KEY ("audit_engagement_id") REFERENCES "audit_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_scope_framework_versions" ADD CONSTRAINT "audit_scope_framework_versions_framework_version_id_fkey" FOREIGN KEY ("framework_version_id") REFERENCES "framework_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_scope_framework_versions" ADD CONSTRAINT "audit_scope_framework_versions_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "audit_scope_requirements" (
    "id" UUID NOT NULL,
    "audit_engagement_id" UUID NOT NULL,
    "requirement_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "linked_by_user_id" UUID NOT NULL,

    CONSTRAINT "audit_scope_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_scope_requirements_audit_engagement_id_idx" ON "audit_scope_requirements"("audit_engagement_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_scope_requirements_audit_engagement_id_requirement_id_key" ON "audit_scope_requirements"("audit_engagement_id", "requirement_id");

-- AddForeignKey
ALTER TABLE "audit_scope_requirements" ADD CONSTRAINT "audit_scope_requirements_audit_engagement_id_fkey" FOREIGN KEY ("audit_engagement_id") REFERENCES "audit_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_scope_requirements" ADD CONSTRAINT "audit_scope_requirements_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_scope_requirements" ADD CONSTRAINT "audit_scope_requirements_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "audit_scope_controls" (
    "id" UUID NOT NULL,
    "audit_engagement_id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "linked_by_user_id" UUID NOT NULL,

    CONSTRAINT "audit_scope_controls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_scope_controls_audit_engagement_id_idx" ON "audit_scope_controls"("audit_engagement_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_scope_controls_audit_engagement_id_control_id_key" ON "audit_scope_controls"("audit_engagement_id", "control_id");

-- AddForeignKey
ALTER TABLE "audit_scope_controls" ADD CONSTRAINT "audit_scope_controls_audit_engagement_id_fkey" FOREIGN KEY ("audit_engagement_id") REFERENCES "audit_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_scope_controls" ADD CONSTRAINT "audit_scope_controls_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_scope_controls" ADD CONSTRAINT "audit_scope_controls_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
