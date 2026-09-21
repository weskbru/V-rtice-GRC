-- T187/US9 — Collaboration baseline: `Attachment`, `Comment`, `Notification`
-- (data-model.md §6, ADR-008, ADR-010, FR-095 to FR-101), plus the
-- `AttachableEntityType`/`CommentableEntityType` polymorphic-reference enums
-- (the same documented exception `ApprovableEntityType` already
-- establishes — `20260905170100_risk_lifecycle_and_approvals_baseline`).
--
-- Hand-written (never `prisma migrate dev` against a real database — see
-- schema.prisma's header and docs/local-environment.md), corresponding 1:1
-- to the models added to schema.prisma in this same change. No append-only
-- enforcement is needed for any of these three tables (unlike
-- `audit_event`/`approvals`/`risk_lifecycle_transitions`): each is a
-- normal mutable table with exactly one legitimate post-insert mutation
-- (`deletedAt`/`deletedByUserId` on `attachments`/`comments`, `readAt` on
-- `notifications`) that the default `pharos_app` grants (SELECT, INSERT,
-- UPDATE, DELETE — `docker/postgres/init/01-roles.sql`) already cover.

-- CreateEnum
CREATE TYPE "AttachableEntityType" AS ENUM ('RISK');

-- CreateEnum
CREATE TYPE "CommentableEntityType" AS ENUM ('RISK');

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "entity_type" "AttachableEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "entity_type" "CommentableEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "author_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entity_type" "CommentableEntityType",
    "entity_id" UUID,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_entity_type_entity_id_deleted_at_idx" ON "attachments"("entity_type", "entity_id", "deleted_at");

-- CreateIndex
CREATE INDEX "comments_entity_type_entity_id_deleted_at_idx" ON "comments"("entity_type", "entity_id", "deleted_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_read_at_created_at_idx" ON "notifications"("recipient_user_id", "read_at", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — deliberately NO FK from `attachments.entity_id` to `risks`:
-- `entityType`/`entityId` is the documented polymorphic exception (ADR-008,
-- same shape as `approvals`) so a future module's own attachable entity
-- type participates without a schema change to this table.
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
