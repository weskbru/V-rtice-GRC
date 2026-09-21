-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AuthenticationMethod" AS ENUM ('LOCAL', 'LDAP', 'ACTIVE_DIRECTORY', 'OIDC', 'SAML');

-- CreateEnum
CREATE TYPE "SessionRevocationReason" AS ENUM ('LOGOUT', 'EXPIRED', 'ADMIN_REVOKED', 'USER_DEACTIVATED', 'PASSWORD_CHANGED');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'ADMINISTER', 'ASSESS', 'TREAT', 'TRANSITION');

-- CreateEnum
CREATE TYPE "OrgUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrgScopeType" AS ENUM ('UNIT', 'GLOBAL');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('USER', 'LOCAL_CREDENTIAL', 'EXTERNAL_IDENTITY', 'SESSION', 'PERMISSION', 'ROLE', 'ROLE_PERMISSION', 'USER_ROLE', 'ORGANIZATIONAL_UNIT', 'ORG_SCOPE_GRANT');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "job_title" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "primary_org_unit_id" UUID,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_changed_at" TIMESTAMPTZ(6) NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),

    CONSTRAINT "local_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "method" "AuthenticationMethod" NOT NULL,
    "external_subject" TEXT NOT NULL,
    "last_synced_at" TIMESTAMPTZ(6),

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "authentication_method" "AuthenticationMethod" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" "SessionRevocationReason",

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "granted_by_user_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "organizational_units" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "status" "OrgUnitStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "organizational_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_scope_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scope_type" "OrgScopeType" NOT NULL,
    "org_unit_id" UUID,
    "granted_by_user_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "org_scope_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "actor_user_id" UUID,
    "actor_label" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" "AuditEntityType" NOT NULL,
    "entity_id" UUID,
    "previous_values" JSONB,
    "new_values" JSONB,
    "organizational_unit_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "session_id" UUID,
    "correlation_id" UUID NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id","occurred_at")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "local_credentials_user_id_key" ON "local_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_method_external_subject_key" ON "external_identities"("method", "external_subject");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_identifier_key" ON "permissions"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "organizational_units_code_key" ON "organizational_units"("code");

-- CreateIndex
CREATE INDEX "organizational_units_parent_id_idx" ON "organizational_units"("parent_id");

-- CreateIndex
CREATE INDEX "organizational_units_path_pattern_idx" ON "organizational_units"("path" text_pattern_ops);

-- CreateIndex
CREATE INDEX "audit_event_entity_idx" ON "audit_event"("entity_type", "entity_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_actor_idx" ON "audit_event"("actor_user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_occurred_at_idx" ON "audit_event"("occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_primary_org_unit_id_fkey" FOREIGN KEY ("primary_org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_credentials" ADD CONSTRAINT "local_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_scope_grants" ADD CONSTRAINT "org_scope_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_scope_grants" ADD CONSTRAINT "org_scope_grants_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_scope_grants" ADD CONSTRAINT "org_scope_grants_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_organizational_unit_id_fkey" FOREIGN KEY ("organizational_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CheckConstraint (data-model.md §4, T037): a GLOBAL grant carries no unit;
-- a UNIT grant must carry one. Prisma's schema language has no `@check`
-- attribute, so this is added by hand as a database-level backstop to the
-- domain rule (FR-025a/FR-025b), same rationale as ADR-006's segregation-
-- of-duties CHECK on `Approval`.
ALTER TABLE "org_scope_grants"
    ADD CONSTRAINT "org_scope_grants_scope_type_check"
    CHECK (
        ("scope_type" = 'GLOBAL' AND "org_unit_id" IS NULL)
        OR ("scope_type" = 'UNIT' AND "org_unit_id" IS NOT NULL)
    );
