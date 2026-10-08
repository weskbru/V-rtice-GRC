-- T003/004-compliance-management — `requirement_control_mapping_migrations`
-- and `requirement_control_mapping_migration_items` (data-model.md §5,
-- research.md D-6): a mapping migration between two versions of the SAME
-- framework as a first-class, auditable event. Schema-only in this
-- migration — the domain/application/presentation code that writes these
-- tables is User Story 2 (out of this workstream's own scope).

-- CreateEnum
CREATE TYPE "MappingMigrationOutcome" AS ENUM ('COPIED', 'PENDING_DECISION', 'SKIPPED_ALREADY_MAPPED');

-- CreateTable
CREATE TABLE "requirement_control_mapping_migrations" (
    "id" UUID NOT NULL,
    "framework_id" UUID NOT NULL,
    "source_framework_version_id" UUID NOT NULL,
    "target_framework_version_id" UUID NOT NULL,
    "executed_at" TIMESTAMPTZ(6) NOT NULL,
    "executed_by_user_id" UUID NOT NULL,

    CONSTRAINT "requirement_control_mapping_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirement_control_mapping_migrations_target_framework_ver_idx" ON "requirement_control_mapping_migrations"("target_framework_version_id");

-- AddForeignKey
ALTER TABLE "requirement_control_mapping_migrations" ADD CONSTRAINT "requirement_control_mapping_migrations_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "frameworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_control_mapping_migrations" ADD CONSTRAINT "requirement_control_mapping_migrations_source_fw_version_fkey" FOREIGN KEY ("source_framework_version_id") REFERENCES "framework_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_control_mapping_migrations" ADD CONSTRAINT "requirement_control_mapping_migrations_target_fw_version_fkey" FOREIGN KEY ("target_framework_version_id") REFERENCES "framework_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_control_mapping_migrations" ADD CONSTRAINT "requirement_control_mapping_migrations_executed_by_fkey" FOREIGN KEY ("executed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "requirement_control_mapping_migration_items" (
    "id" UUID NOT NULL,
    "migration_id" UUID NOT NULL,
    "target_requirement_id" UUID NOT NULL,
    "source_requirement_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "outcome" "MappingMigrationOutcome" NOT NULL,
    "copied_link_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "requirement_control_mapping_migration_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — full read of one execution in a single query (data-model.md §5).
CREATE INDEX "requirement_control_mapping_migration_items_migration_id_idx" ON "requirement_control_mapping_migration_items"("migration_id");

-- AddForeignKey
ALTER TABLE "requirement_control_mapping_migration_items" ADD CONSTRAINT "requirement_control_mapping_migration_items_migration_fkey" FOREIGN KEY ("migration_id") REFERENCES "requirement_control_mapping_migrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_control_mapping_migration_items" ADD CONSTRAINT "requirement_control_mapping_migration_items_target_req_fkey" FOREIGN KEY ("target_requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
