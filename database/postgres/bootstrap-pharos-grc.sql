-- Inicialização única do schema PharosGRC.
-- Fonte: database/prisma/migrations.
-- Execute uma vez, no banco pharos_grc, pelo DBeaver.
-- Requer citext e pg_trgm instaladas no servidor PostgreSQL.
-- Registra os checksums originais no histórico Prisma.

DO $bootstrap_check$
DECLARE
    missing_extensions TEXT;
    has_applied_migrations BOOLEAN;
    has_unresolved_failures BOOLEAN;
BEGIN
    IF current_database() <> 'pharos_grc' THEN
        RAISE EXCEPTION 'Conecte ao banco pharos_grc antes de executar este script.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pharos_owner') THEN
        RAISE EXCEPTION 'O papel pharos_owner não existe.';
    END IF;
    IF current_user <> 'pharos_owner' AND NOT pg_has_role(current_user, 'pharos_owner', 'SET') THEN
        RAISE EXCEPTION 'A conexão precisa poder assumir o papel pharos_owner.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pharos_app') THEN
        RAISE EXCEPTION 'O papel pharos_app não existe.';
    END IF;
    SELECT string_agg(required.name, ', ' ORDER BY required.name)
      INTO missing_extensions
      FROM unnest(ARRAY['citext', 'pg_trgm']) AS required(name)
     WHERE NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = required.name);
    IF missing_extensions IS NOT NULL THEN
        RAISE EXCEPTION 'Extensões ausentes no servidor PostgreSQL: %.', missing_extensions
            USING HINT = 'Peça ao administrador para instalar citext e pg_trgm no PostgreSQL 17.';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations') THEN
        RAISE EXCEPTION 'O schema public já contém tabelas da aplicação; este bootstrap exige um schema vazio.';
    END IF;
    IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)'
            INTO has_applied_migrations;
        IF has_applied_migrations THEN
            RAISE EXCEPTION 'Já há migrações aplicadas; não execute o bootstrap novamente.';
        END IF;
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL)'
            INTO has_unresolved_failures;
        IF has_unresolved_failures THEN
            RAISE EXCEPTION 'Há uma migração Prisma com falha não resolvida.';
        END IF;
    END IF;
END
$bootstrap_check$;

BEGIN;
SET LOCAL ROLE pharos_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE pharos_grc TO pharos_app;
GRANT USAGE ON SCHEMA public TO pharos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pharos_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pharos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pharos_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO pharos_app;

CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- Migração: 20260905120000_core_identity_authz_audit_baseline
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

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'd4463893-72de-5685-90af-6fd54b95af33',
    'a509a0360b859bd5ac85015cc269b680a9365891522e080b009aafb756a95403',
    CURRENT_TIMESTAMP,
    '20260905120000_core_identity_authz_audit_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905120100_audit_event_partitioning
-- T027 — Convert `audit_event` to monthly RANGE partitioning (ADR-005).
--
-- `audit_event` was created as an ordinary table by the baseline migration
-- because Prisma's schema language cannot express `PARTITION BY`. This
-- migration drops that table — still empty in every environment this has
-- run against, since it is the very next migration after the table's
-- creation — and recreates it as the partitioned table it must be, with
-- the same columns, primary key, foreign keys and indexes, then creates an
-- initial window of monthly partitions plus a DEFAULT partition and a
-- callable function for creating future ones.
--
-- ## Why the primary key is (id, occurred_at), not id alone
--
-- PostgreSQL requires a partitioned table's primary key (and every unique
-- index) to include the partition key column. `schema.prisma` already
-- declares `@@id([id, occurredAt])` on `AuditEvent` for exactly this
-- reason — see that file's header comment. Consequence for every future
-- caller: `id` alone is not a database-enforced unique identifier of a
-- row; addressing one specific audit event efficiently requires supplying
-- `occurredAt` too (or scanning via the entityType/actorUserId/occurredAt
-- indexes below), not a bare `WHERE id = $1`.
--
-- ## Why a DEFAULT partition exists
--
-- Without a DEFAULT partition, an INSERT whose `occurred_at` falls outside
-- every declared range partition fails outright — an unacceptable outcome
-- for FR-034 ("insert must always succeed"), since the initial partition
-- window is finite and an operator could plausibly fall behind on running
-- `create_audit_event_partition()` for upcoming months, or a caller could
-- supply a clock-skewed or backdated `occurredAt`. The DEFAULT partition
-- guarantees the insert never fails for that reason.
--
-- Operating it implies a trade-off that must be monitored: rows can
-- silently accumulate in `audit_event_default` if partition maintenance
-- falls behind, which defeats partitioning's main operational benefit for
-- those rows (cheap retention via `DETACH PARTITION` instead of a mass
-- `DELETE`). A non-trivial row count in `audit_event_default` is a signal
-- that `create_audit_event_partition()` needs to be run for upcoming
-- months. No scheduler is introduced to do this automatically — ADR-015
-- forbids asynchronous infrastructure in this release — so partition
-- creation stays an explicit, callable SQL function, run by an operator or
-- by a future reviewed migration.

-- DropTable
DROP TABLE "audit_event";

-- CreateTable (now partitioned)
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

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id", "occurred_at")
) PARTITION BY RANGE ("occurred_at");

-- CreateIndex — defined on the partitioned parent. PostgreSQL automatically
-- creates and maintains a matching local index on every current and future
-- partition; nothing further is needed per partition.
CREATE INDEX "audit_event_entity_idx" ON "audit_event"("entity_type", "entity_id", "occurred_at" DESC);
CREATE INDEX "audit_event_actor_idx" ON "audit_event"("actor_user_id", "occurred_at" DESC);
CREATE INDEX "audit_event_occurred_at_idx" ON "audit_event"("occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_organizational_unit_id_fkey" FOREIGN KEY ("organizational_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- `pharos_config` — the single source of truth for the application role's
-- name, read by `create_audit_event_partition()` below and by the
-- privilege statements in the next migration (T028).
--
-- The original design for this used a database-level custom GUC
-- (`ALTER DATABASE ... SET pharos.app_role = ...`), read back everywhere
-- via `current_setting(...)`. That does not work here: PostgreSQL 15+
-- gates `ALTER DATABASE`/`ALTER ROLE ... SET` of a parameter behind a
-- `pg_parameter_acl` grant that only a superuser can hand out (a plain
-- session-level `SET` of a custom placeholder parameter needs no such
-- grant, but persisting it at the database level does), and neither role
-- available to this project (`pharos_owner`, `pharos_app`) is a
-- superuser — confirmed empirically against this PostgreSQL 18 instance
-- (`ALTER DATABASE pharos_grc SET pharos.app_role = 'pharos_app'` as
-- `pharos_owner` fails with `permissão negada ao definir parâmetro`,
-- while plain `SET pharos.app_role = 'pharos_app'` in the same session
-- succeeds). A one-row config table needs no privilege beyond owning the
-- table, which `pharos_owner` already has, and is read identically from
-- any session, present or future — so it replaces the GUC design.
--
-- The literal 'pharos_app' appears exactly once below (the INSERT) and
-- once more in the REVOKE immediately after (REVOKE needs a role
-- identifier, which cannot be parameterized without EXECUTE format(...);
-- since this REVOKE is about protecting the row that names the app role,
-- from the app role, spelling it out here is the unavoidable bootstrap —
-- every other GRANT/REVOKE in this migration and in T028 reads the name
-- back from this table instead of repeating the literal).
CREATE TABLE "pharos_config" (
    "key"   TEXT PRIMARY KEY,
    "value" TEXT NOT NULL
);

COMMENT ON TABLE "pharos_config" IS
    'Tiny platform settings table. Currently holds one row: the application database role''s name (key = ''app_role''), read by create_audit_event_partition() and by the audit_event append-only migration, so that role name is declared once and every dynamic GRANT/REVOKE reads it back rather than repeating the literal. Not a general-purpose settings table for application features — those belong in the Configuration core capability (CLAUDE.md §4), not here.';

INSERT INTO "pharos_config" ("key", "value") VALUES ('app_role', 'pharos_app');

-- Lock the table down: only pharos_owner (its creator) may read or write
-- it. Without this, the schema-wide default privilege that grants
-- pharos_app SELECT/INSERT/UPDATE/DELETE on every new table pharos_owner
-- creates (docs/local-environment.md) would apply here too, letting the
-- application role read — and worse, rewrite — the very row that names it.
REVOKE ALL ON "pharos_config" FROM PUBLIC;
REVOKE ALL ON "pharos_config" FROM "pharos_app";

-- Callable partition-creation function (no scheduler — ADR-015). Given any
-- date within a target month, creates that month's partition if it does
-- not already exist, then grants it the same append-only policy as the
-- rest of audit_event using the role named in `pharos_config` above:
-- SELECT/INSERT granted, UPDATE/DELETE revoked. This is the mechanism that
-- keeps FR-034 holding for partitions created after today, which a
-- human-run migration cannot anticipate the names of.
--
-- Idempotent: calling it again for a month that already has a partition
-- is a no-op. Must be run as a role with ownership privileges on
-- audit_event (pharos_owner) — it is not SECURITY DEFINER, and a run as
-- pharos_app would fail at the CREATE TABLE step for lack of privilege
-- (and could not even see `pharos_config`, per the REVOKE above).
CREATE OR REPLACE FUNCTION create_audit_event_partition(target_month date)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
    partition_start date := (date_trunc('month', target_month))::date;
    partition_end   date := (date_trunc('month', target_month) + interval '1 month')::date;
    partition_name  text := format('audit_event_%s', to_char(partition_start, 'YYYY_MM'));
    app_role        text := (SELECT value FROM pharos_config WHERE key = 'app_role');
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name AND n.nspname = 'public' AND c.relkind IN ('r', 'p')
    ) THEN
        RETURN;
    END IF;

    EXECUTE format(
        'CREATE TABLE %I PARTITION OF "audit_event" FOR VALUES FROM (%L) TO (%L)',
        partition_name, partition_start, partition_end
    );

    IF app_role IS NOT NULL AND app_role <> '' THEN
        EXECUTE format('GRANT SELECT, INSERT ON %I TO %I', partition_name, app_role);
        EXECUTE format('REVOKE UPDATE, DELETE ON %I FROM %I', partition_name, app_role);
    END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION create_audit_event_partition(date) FROM PUBLIC;

COMMENT ON FUNCTION create_audit_event_partition(date) IS
    'Idempotently creates the monthly audit_event partition containing target_month, and grants the role named in pharos_config (key = ''app_role'') SELECT/INSERT while revoking UPDATE/DELETE on it, so FR-034 (append-only) holds for partitions created after today. Call ahead of need (an empty audit_event_default is the sign nothing is overdue). Must be run as pharos_owner. No scheduler invokes this automatically (ADR-015) — it is an operational or future-migration responsibility.';

-- Initial partition window: the current month plus six months ahead, so
-- there is headroom before an operator must run
-- create_audit_event_partition() again. Computed from the UTC calendar
-- date (not the session's TimeZone setting) so the window is identical
-- regardless of which timezone the connecting session happens to have.
DO $$
DECLARE
    i int;
    base date := (date_trunc('month', now() AT TIME ZONE 'UTC'))::date;
BEGIN
    FOR i IN 0..6 LOOP
        PERFORM create_audit_event_partition((base + (i || ' months')::interval)::date);
    END LOOP;
END;
$$;

-- DEFAULT partition — see the file-level comment above for what this is
-- for and the operational trade-off it accepts. Created directly (not via
-- the function above) because a DEFAULT partition is declared with the
-- `DEFAULT` keyword, not a `FOR VALUES FROM/TO` range.
CREATE TABLE "audit_event_default" PARTITION OF "audit_event" DEFAULT;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'd0ff2bab-4aff-5d11-8074-eccb449b9fe3',
    '6bbbc86f203e4097583d04a99d675ec7dbeead6bd734d8d7cacbbd9bbfe038be',
    CURRENT_TIMESTAMP,
    '20260905120100_audit_event_partitioning',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905120200_audit_event_append_only
-- T028 — Enforce append-only on `audit_event` at the database (FR-034,
-- ADR-005): the application role gets INSERT/SELECT only, and a
-- BEFORE UPDATE OR DELETE trigger raises even for a privileged mistake.
--
-- The application role's name is read from `pharos_config` (created by the
-- previous migration, T027 — see that file for why a one-row config table
-- is used here instead of a database-level custom setting: PostgreSQL 15+
-- requires a superuser-granted parameter ACL to persist a custom GUC via
-- `ALTER DATABASE ... SET`, which neither `pharos_owner` nor `pharos_app`
-- has on this instance). Every GRANT/REVOKE below reads
-- `(SELECT value FROM pharos_config WHERE key = 'app_role')` instead of
-- repeating the literal 'pharos_app'.

-- Trigger function: unconditionally rejects UPDATE and DELETE. Kept
-- separate from privilege revocation on purpose (ADR-005): GRANT/REVOKE
-- protects against the *application* role; a trigger protects against
-- *any* role, including pharos_owner running an ad hoc UPDATE by mistake,
-- because owning a table does not exempt it from its own triggers.
CREATE OR REPLACE FUNCTION audit_event_prevent_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
    RAISE EXCEPTION 'audit_event is append-only: % is not permitted (FR-034)', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$fn$;

COMMENT ON FUNCTION audit_event_prevent_modification() IS
    'Backstop for FR-034 / ADR-005: audit_event and its partitions accept INSERT and SELECT only. Raises for every role, including the table owner, so a mistaken UPDATE/DELETE fails loudly instead of silently succeeding because a GRANT happened to be missing.';

-- Defined on the partitioned PARENT only. Since PostgreSQL 11, a row-level
-- trigger declared on a partitioned table is automatically cloned to every
-- existing partition AND to every partition created afterwards — this is
-- exactly why this trigger, unlike the GRANT/REVOKE below, needs no
-- per-partition maintenance and needs no help from
-- create_audit_event_partition(). Verified empirically for this migration;
-- see the implementation report's verification transcript (item 5): a
-- brand-new partition, created after this migration ran, rejected UPDATE
-- via this same trigger with no further action taken on the new partition
-- itself.
CREATE TRIGGER audit_event_append_only
    BEFORE UPDATE OR DELETE ON "audit_event"
    FOR EACH ROW
    EXECUTE FUNCTION audit_event_prevent_modification();

-- Privileges: GRANT/REVOKE on a partitioned table's own ACL and on each
-- partition's ACL are independent in PostgreSQL — unlike the trigger
-- above, they do NOT cascade automatically to partitions, existing or
-- future. This is "the part that is easy to get wrong": a GRANT issued
-- only on the parent `audit_event` name is sufficient for queries that go
-- through the parent, but anything touching a partition directly (by name,
-- or via `tableoid`-qualified access) is checked against that partition's
-- own ACL. So every partition existing right now — including the DEFAULT
-- partition — gets the same explicit GRANT/REVOKE as the parent, and every
-- partition created after today gets it from
-- `create_audit_event_partition()` (T027), which performs the same two
-- statements using the role name from `pharos_config`. There is no third
-- path for a partition to come into existence (partition creation is a DDL
-- operation only pharos_owner can perform), so covering the parent, every
-- existing partition and the creation function is the complete set.
DO $$
DECLARE
    app_role text := (SELECT value FROM pharos_config WHERE key = 'app_role');
    rec record;
BEGIN
    IF app_role IS NULL THEN
        RAISE EXCEPTION 'pharos_config has no app_role row — cannot enforce audit_event append-only privileges';
    END IF;

    EXECUTE format('GRANT SELECT, INSERT ON %I TO %I', 'audit_event', app_role);
    EXECUTE format('REVOKE UPDATE, DELETE ON %I FROM %I', 'audit_event', app_role);

    FOR rec IN
        SELECT c.relname
        FROM pg_inherits i
        JOIN pg_class c ON c.oid = i.inhrelid
        JOIN pg_class p ON p.oid = i.inhparent
        JOIN pg_namespace n ON n.oid = p.relnamespace
        WHERE p.relname = 'audit_event' AND n.nspname = 'public'
    LOOP
        EXECUTE format('GRANT SELECT, INSERT ON %I TO %I', rec.relname, app_role);
        EXECUTE format('REVOKE UPDATE, DELETE ON %I FROM %I', rec.relname, app_role);
    END LOOP;
END;
$$;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '32944823-727f-504b-92c5-591b899adddc',
    '34422b64076a9e8e20a47417f717eceb9132c4934307f47558495a5724001244',
    CURRENT_TIMESTAMP,
    '20260905120200_audit_event_append_only',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905130000_createdat_updatedat_reconciliation
-- D-7 — createdAt/updatedAt reconciliation (docs/local-environment.md).
--
-- data-model.md's "Shared conventions" preamble states every table carries
-- `createdAt`/`updatedAt`, but the per-table field lists in sections 1-4
-- mostly omitted them, and the baseline migration (T026) implemented the
-- field lists literally. The coordinator's decision: add `created_at`/
-- `updated_at` to the mutable entity tables that lack them —
-- `local_credentials`, `external_identities`, `permissions`, `roles`,
-- `organizational_units` — and explicitly NOT to join tables
-- (`role_permissions`, `user_roles`, `org_scope_grants` — their
-- `granted_at` already carries the semantic timestamp), NOT to `sessions`
-- (`created_at` + `last_activity_at` are the meaningful instants), and NOT
-- to `audit_event` (append-only; `occurred_at` is the timestamp, and a
-- mutable `updated_at` on an immutable table would be incoherent).
--
-- Additive and forward-only: every column is added NOT NULL with a
-- CURRENT_TIMESTAMP default, which both backfills any existing row (the
-- default applies to rows that already exist at ADD COLUMN time, not only
-- to future inserts) and supplies every future insert issued outside
-- Prisma. Prisma's own `@updatedAt` directive stamps a fresh value on every
-- application-level update regardless of this default; the default exists
-- as a database-level backstop so a raw SQL insert can never violate
-- NOT NULL, mirroring `users.created_at`'s existing DEFAULT CURRENT_TIMESTAMP.

-- CreateColumn: local_credentials
ALTER TABLE "local_credentials" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "local_credentials" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateColumn: external_identities
ALTER TABLE "external_identities" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "external_identities" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateColumn: permissions
ALTER TABLE "permissions" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "permissions" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateColumn: roles
ALTER TABLE "roles" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "roles" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateColumn: organizational_units
ALTER TABLE "organizational_units" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organizational_units" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '8770a086-2ec4-56c6-b56a-ddcf969af581',
    'f792527db09ea38515d100fe9165ba52554346c0d8d4e17e86a23a52ba173af9',
    CURRENT_TIMESTAMP,
    '20260905130000_createdat_updatedat_reconciliation',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905130100_authorization_scope_cache_counters
-- T036/T039 — durable version counters backing the RBAC permission cache
-- and the organizational-scope cache (ADR-003, ADR-004).
--
-- Both `permission-resolver.service.ts` and `scope-resolver.service.ts`
-- cache their *resolved* answer (a permission set / a scope filter) behind
-- a key that embeds a version number, so that bumping the version is what
-- invalidates every affected cache entry on the next lookup — no TTL wait,
-- no enumerating which cache keys to delete (FR-028). That version number
-- itself must be durable and monotonic: if it lived only inside
-- `CacheProvider` (which both the Redis and in-memory adapters may evict or
-- expire independently of any single cached permission/scope entry), the
-- counter resetting to a lower value while an older, still-unexpired
-- resolved-answer entry survives under a matching lower-numbered key would
-- silently serve stale data. Two single-row tables here are the persisted,
-- authoritative home for these counters; only the resolved answers are
-- ever cache-resident.
--
-- Each table is seeded with its one singleton row so the very first
-- resolver call in a fresh environment can read a value without a
-- create-if-missing race.

-- CreateTable
CREATE TABLE "permission_cache_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "permissions_version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permission_cache_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_scope_cache_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "org_tree_version" INTEGER NOT NULL DEFAULT 1,
    "grants_version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "org_scope_cache_state_pkey" PRIMARY KEY ("id")
);

-- Seed the one singleton row each table will ever hold.
INSERT INTO "permission_cache_state" ("id", "permissions_version", "updated_at")
VALUES ('singleton', 1, CURRENT_TIMESTAMP);

INSERT INTO "org_scope_cache_state" ("id", "org_tree_version", "grants_version", "updated_at")
VALUES ('singleton', 1, 1, CURRENT_TIMESTAMP);

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '219cf868-235e-53f4-a883-8308e9e02dbf',
    '34d59eda84af7422992d9412be52700e651bf1c878f1ad6770d10efabcad5e36',
    CURRENT_TIMESTAMP,
    '20260905130100_authorization_scope_cache_counters',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905140000_audit_entity_type_add_risk
-- T083/US2 — Additive growth of the `AuditEntityType` enum: adds `RISK`
-- (ADR-008: "closed platform enums grow by reviewed migration").
--
-- ## The PostgreSQL restriction this migration must respect
--
-- PostgreSQL 12+ allows `ALTER TYPE ... ADD VALUE` to run inside a
-- transaction block, but a value added this way cannot be referenced
-- (compared, cast, or used as a literal) by any statement in the SAME
-- transaction that added it — only by a later, separate transaction that
-- starts after this one has committed.
--
-- This migration satisfies that restriction trivially: it contains exactly
-- one statement, which adds the label and writes no data using it. Nothing
-- in this file (or in the migration that runs after it,
-- `20260905140100_risk_management_baseline`, which only creates tables and
-- writes no `audit_event` rows) ever uses the literal `'RISK'` in the same
-- transaction it is created in. The very first real use of
-- `AuditEntityType.RISK` is `AuditRecorder.record(...)` called from
-- `CreateRiskUseCase`/`UpdateRiskUseCase` at normal application runtime —
-- an entirely separate transaction, opened long after `prisma migrate
-- deploy` has committed this one.
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '8a4d8322-0094-5f08-94c3-881e44f93818',
    '91e94a0ba6e65d669c5e94db138bb3fc6b9d0c5a4e69e77bd1a037690eab1a55',
    CURRENT_TIMESTAMP,
    '20260905140000_audit_entity_type_add_risk',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905140100_risk_management_baseline
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

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '670205c6-0c42-5d6a-9cb4-7fc629ebb813',
    '1c6214aae12c37571ac9a8a50c8013d7e560c63a00598a5f77e2ef7d44792e16',
    CURRENT_TIMESTAMP,
    '20260905140100_risk_management_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905150000_audit_entity_type_add_risk_assessment_methodology
-- T120/T124/T126/US4 — Additive growth of the `AuditEntityType` enum: adds
-- `RISK_ASSESSMENT` and `RISK_METHODOLOGY_VERSION` (ADR-008: "closed
-- platform enums grow by reviewed migration"), the same mechanism as
-- `20260905140000_audit_entity_type_add_risk`.
--
-- ## The PostgreSQL restriction this migration must respect (see that
-- ## earlier migration's header for the full explanation)
--
-- A value added by `ALTER TYPE ... ADD VALUE` inside a transaction cannot be
-- referenced (compared, cast, used as a literal) by any statement in the
-- SAME transaction that added it. This migration contains exactly two such
-- statements and writes no `audit_event` row using either new label — the
-- first real use of `AuditEntityType.RISK_ASSESSMENT` is
-- `AuditRecorder.record(...)` from `CreateAssessmentUseCase`, and of
-- `AuditEntityType.RISK_METHODOLOGY_VERSION` is the same call from
-- `PublishMethodologyVersionUseCase` — both at normal application runtime,
-- in transactions opened long after `prisma migrate deploy` has committed
-- this one.
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_ASSESSMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_METHODOLOGY_VERSION';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '9d2d7c10-1699-52e1-bcc0-f6e37a7bb43c',
    'f389f01729a7b4b7f958de35b4400024eb8a281ca082ffeddbc412b9bfec2e16',
    CURRENT_TIMESTAMP,
    '20260905150000_audit_entity_type_add_risk_assessment_methodology',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905150100_risk_assessment_methodology_baseline
-- T120/US4 — Risk Methodology configuration and Assessment baseline:
-- `RiskMethodology`, `RiskMethodologyVersion`, `RiskAssessment`
-- (data-model.md §7/§9), plus the `risks.current_assessment_id` FK deferred
-- from the US2 baseline migration (`20260905140100_risk_management_baseline`
-- — see that model's own header in schema.prisma).
--
-- Hand-written (never `prisma migrate dev` — see schema.prisma's header and
-- docs/local-environment.md), corresponding 1:1 to the models added to
-- schema.prisma in this same change, with the additions Prisma's schema
-- language cannot express: the partial unique index on
-- `risk_methodologies.is_active`, the `CHECK` constraints on
-- `risk_assessments`, and `RiskMethodologyVersion`'s append-only privilege
-- revocation — each documented at its own statement below.

-- CreateTable
CREATE TABLE "risk_methodologies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risk_methodologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_methodology_versions" (
    "id" UUID NOT NULL,
    "methodology_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "probability_scale" JSONB NOT NULL,
    "impact_scale" JSONB NOT NULL,
    "matrix" JSONB NOT NULL,
    "level_bands" JSONB NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID NOT NULL,

    CONSTRAINT "risk_methodology_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "methodology_version_id" UUID NOT NULL,
    "assessed_by_user_id" UUID NOT NULL,
    "assessed_on" DATE NOT NULL,
    "inherent_probability" INTEGER NOT NULL,
    "inherent_impact" INTEGER NOT NULL,
    "inherent_score" INTEGER NOT NULL,
    "inherent_level" "RiskLevel" NOT NULL,
    "residual_probability" INTEGER NOT NULL,
    "residual_impact" INTEGER NOT NULL,
    "residual_score" INTEGER NOT NULL,
    "residual_level" "RiskLevel" NOT NULL,
    "controls_considered" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "rationale" TEXT,
    "previous_assessment_id" UUID,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "risk_methodology_versions_methodology_id_version_number_key" ON "risk_methodology_versions"("methodology_id", "version_number");

-- CreateIndex
CREATE INDEX "risk_assessments_risk_id_assessed_on_idx" ON "risk_assessments"("risk_id", "assessed_on" DESC);

-- data-model.md §7: "exactly one active, enforced by a partial unique
-- index". Prisma's schema language has no partial-index syntax, so this is
-- hand-written, the same documented drift pattern as `audit_event`'s
-- partitioning and `risks`' GIN trigram index.
CREATE UNIQUE INDEX "risk_methodologies_one_active_idx" ON "risk_methodologies" ("is_active") WHERE "is_active" = true;

-- AddForeignKey
ALTER TABLE "risk_methodology_versions" ADD CONSTRAINT "risk_methodology_versions_methodology_id_fkey" FOREIGN KEY ("methodology_id") REFERENCES "risk_methodologies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_methodology_versions" ADD CONSTRAINT "risk_methodology_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_methodology_version_id_fkey" FOREIGN KEY ("methodology_version_id") REFERENCES "risk_methodology_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_assessed_by_user_id_fkey" FOREIGN KEY ("assessed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_previous_assessment_id_fkey" FOREIGN KEY ("previous_assessment_id") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — the `risks.current_assessment_id` column already exists
-- (created plain, with no FK, by `20260905140100_risk_management_baseline`
-- — see that model's own header in schema.prisma for why it was deferred).
-- `risk_assessments` now exists, so the FK is added here.
ALTER TABLE "risks" ADD CONSTRAINT "risks_current_assessment_id_fkey" FOREIGN KEY ("current_assessment_id") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint (data-model.md §9: "not null, CHECK within scale bounds").
--
-- What this CAN express: every factor value is a positive integer — the
-- static floor every configured scale shares (`ScalePoint.value: minimum:
-- 1` in contracts/platform.openapi.yaml). What it CANNOT express: whether
-- the value is actually a member of the SPECIFIC methodology version this
-- row is pinned to (`methodology_version_id`) — that scale lives in a
-- sibling table's `jsonb` column, and a single-table `CHECK` constraint
-- cannot perform a cross-table JSON lookup (nor would it be sound to: the
-- constraint would have to be re-validated against a DIFFERENT row's data,
-- which PostgreSQL `CHECK` constraints do not support). True
-- scale-membership validation is therefore an application-boundary
-- responsibility: `RiskScoringService.score()`
-- (`domain/risk-scoring.service.ts`, T122) rejects an out-of-scale value
-- with a 422 before this row is ever inserted (FR-067). This `CHECK` is a
-- real, always-on database backstop for the part it CAN prove — never zero,
-- negative or fractional — same rationale as `org_scope_grants_scope_type_
-- check` in the Core baseline migration.
ALTER TABLE "risk_assessments"
    ADD CONSTRAINT "risk_assessments_inherent_probability_check"
    CHECK ("inherent_probability" >= 1);
ALTER TABLE "risk_assessments"
    ADD CONSTRAINT "risk_assessments_inherent_impact_check"
    CHECK ("inherent_impact" >= 1);
ALTER TABLE "risk_assessments"
    ADD CONSTRAINT "risk_assessments_residual_probability_check"
    CHECK ("residual_probability" >= 1);
ALTER TABLE "risk_assessments"
    ADD CONSTRAINT "risk_assessments_residual_impact_check"
    CHECK ("residual_impact" >= 1);

-- ---------------------------------------------------------------------------
-- `RiskMethodologyVersion` append-only enforcement (FR-068) — interpretive
-- decision, documented per this task's explicit instruction to justify it
-- either way.
-- ---------------------------------------------------------------------------
--
-- DECISION: revoke `UPDATE`/`DELETE` from the restricted application role
-- (`pharos_app`) on `risk_methodology_versions`. Deliberately NO trigger,
-- unlike `audit_event`'s `audit_event_prevent_modification`
-- (`20260905120200_audit_event_append_only`).
--
-- Why a real database guarantee is worth adding here at all: `RiskAssessment`
-- rows PIN a `methodologyVersionId` specifically so a later configuration
-- change can never retroactively alter a historical result (FR-068) — this
-- is the exact property T117's test exists to prove, and the guarantee is
-- only as strong as "no code path can ever UPDATE a version row". Making
-- that cheap and real at the database, not merely conventional, is squarely
-- what this task calls for.
--
-- Why NOT the full `audit_event` treatment (trigger + revoke), i.e. why the
-- asymmetry is deliberate rather than an oversight:
--
--   1. `audit_event` is the platform's own tamper-evidence mechanism
--      (ADR-005) — it must resist even a mistaken statement run BY THE OWNER
--      role, because if the audit trail itself can be silently altered by
--      any credential the platform trusts, auditability as a whole is
--      compromised. `risk_methodology_versions` carries no such
--      platform-wide trust requirement: it is one business configuration
--      table among the ones this migration adds, not the mechanism every
--      OTHER guarantee in the system depends on being intact.
--   2. The application (`pharos_app`) NEVER has a legitimate reason to
--      UPDATE or DELETE this table — `PublishMethodologyVersionUseCase`
--      only ever `create`s. Revoking the privilege from the ONE role that
--      ever connects as the running application removes every application
--      code path that could do it, by construction — the same mechanism
--      `audit_event`'s own privilege revocation half already establishes as
--      sufficient for a table with no legitimate update path. A trigger
--      adds a SECOND, redundant backstop against the owner role
--      (`pharos_owner`) running an ad hoc `UPDATE` directly against the
--      database — a real but strictly narrower threat than what
--      `audit_event` defends against, and one this migration accepts as
--      "administrator with direct database access, gated by whatever
--      controls the organization ITself places around who is trusted to
--      have owner credentials at all" rather than an application-invariant
--      the database must enforce for every possible role.
--   3. Precedent: `pharos_config`/schema-comment conventions in this
--      codebase already treat "revoke the privilege the application would
--      need to violate the rule" as the FIRST-CLASS mechanism (see
--      `org_scope_grants_scope_type_check`'s CHECK-only treatment of a
--      SIMPLER invariant); the trigger on `audit_event` is the exception
--      applied to the one table the whole audit story hinges on, not the
--      default every append-only table automatically receives.
--
-- If a future task needs the stronger, owner-resistant guarantee (e.g. this
-- table becomes as safety-critical as `audit_event`, or a compliance
-- requirement demands it), adding the identical trigger pattern is a
-- one-file additive migration — this decision does not foreclose it, it
-- simply does not adopt it now without a concrete requirement driving it
-- (CLAUDE.md §2: "não criar abstrações prematuras").
DO $$
DECLARE
    app_role text := (SELECT value FROM pharos_config WHERE key = 'app_role');
BEGIN
    IF app_role IS NULL THEN
        RAISE EXCEPTION 'pharos_config has no app_role row — cannot enforce risk_methodology_versions append-only privileges';
    END IF;

    EXECUTE format('GRANT SELECT, INSERT ON %I TO %I', 'risk_methodology_versions', app_role);
    EXECUTE format('REVOKE UPDATE, DELETE ON %I FROM %I', 'risk_methodology_versions', app_role);
END;
$$;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '73bfb956-7b31-56dc-bb97-0d7bcbf790c9',
    '0d64cc79424c234bbdb08d272319a5acb70d866555221ab204e44dba0706d594',
    CURRENT_TIMESTAMP,
    '20260905150100_risk_assessment_methodology_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905160000_audit_entity_type_add_risk_treatment
-- T137/T139/T140/T142/US5 — Additive growth of the `AuditEntityType` enum:
-- adds `RISK_TREATMENT_DECISION`, `RISK_TREATMENT_ACTION`,
-- `RISK_CONTROL_LINK`, `RISK_PROCESS_LINK` and `RISK_ASSET_LINK` (ADR-008:
-- "closed platform enums grow by reviewed migration"). Five distinct values
-- rather than one generic "relationship" value — CLAUDE.md §10/ADR-008 model
-- each risk relationship explicitly, and the audit trail is exactly the
-- place that distinction must not be lost.
--
-- ## The PostgreSQL restriction this migration must respect
--
-- Same restriction as `20260905140000_audit_entity_type_add_risk` and
-- `20260905150000_audit_entity_type_add_risk_assessment_methodology`
-- (see those files' own headers for the full explanation): a value added by
-- `ALTER TYPE ... ADD VALUE` cannot be referenced by any statement in the
-- SAME transaction that added it. This migration contains only five such
-- statements and writes no data using any of the new labels — nor does the
-- migration that runs immediately after it
-- (`20260905160100_risk_treatment_and_relationships_baseline`), which only
-- creates tables/indexes/constraints and writes no `audit_event` rows. The
-- first real use of each new label is `AuditRecorder.record(...)` called at
-- normal application runtime, in an entirely separate transaction opened
-- long after `prisma migrate deploy` has committed this one.
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_TREATMENT_DECISION';
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_TREATMENT_ACTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_CONTROL_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_PROCESS_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_ASSET_LINK';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '25731c38-bac9-5d5f-90b9-d2bea76ccef0',
    'abaa44384ef49ff05de8ac985901a56844049805b1f67a78e661788080f9225d',
    CURRENT_TIMESTAMP,
    '20260905160000_audit_entity_type_add_risk_treatment',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905160100_risk_treatment_and_relationships_baseline
-- T137/T138/US5 — Risk Treatment, Actions, Controls, Processes and Assets
-- baseline: `RiskTreatmentDecision`, `RiskTreatmentAction`, `Control`,
-- `Process`, `Asset`, `RiskControlLink`, `RiskProcessLink`, `RiskAssetLink`
-- (data-model.md §10), plus the `risks.current_treatment_id` FK deferred
-- from the US2 baseline migration (`20260905140100_risk_management_baseline`
-- — see that model's own header in schema.prisma).
--
-- Hand-written (never `prisma migrate dev` — see schema.prisma's header and
-- docs/local-environment.md), corresponding 1:1 to the models added to
-- schema.prisma in this same change, with the additions Prisma's schema
-- language cannot express: the partial unique indexes on the three link
-- tables, and `RiskTreatmentDecision`'s append-only enforcement trigger
-- (both documented at their own statements below).

-- CreateEnum
CREATE TYPE "TreatmentStrategy" AS ENUM ('MITIGATE', 'AVOID', 'TRANSFER', 'ACCEPT');

-- CreateEnum
CREATE TYPE "TreatmentActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "risk_treatment_decisions" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "strategy" "TreatmentStrategy" NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" DATE,
    "decided_by_user_id" UUID NOT NULL,
    "decided_at" TIMESTAMPTZ(6) NOT NULL,
    "superseded_at" TIMESTAMPTZ(6),
    "superseded_by_id" UUID,

    CONSTRAINT "risk_treatment_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_treatment_actions" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "treatment_decision_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsible_user_id" UUID NOT NULL,
    "due_on" DATE NOT NULL,
    "status" "TreatmentActionStatus" NOT NULL DEFAULT 'OPEN',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risk_treatment_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controls" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "org_unit_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "org_unit_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "org_unit_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_control_links" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "risk_control_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_process_links" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "risk_process_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_asset_links" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "risk_asset_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — data-model.md §10: "(riskId, decidedAt DESC)".
CREATE INDEX "risk_treatment_decisions_risk_id_decided_at_idx" ON "risk_treatment_decisions"("risk_id", "decided_at" DESC);

-- CreateIndex — data-model.md §10: "(riskId, status), (responsibleUserId,
-- dueOn), (dueOn, status) for the dashboard's overdue tile".
CREATE INDEX "risk_treatment_actions_risk_id_status_idx" ON "risk_treatment_actions"("risk_id", "status");

-- CreateIndex
CREATE INDEX "risk_treatment_actions_responsible_user_id_due_on_idx" ON "risk_treatment_actions"("responsible_user_id", "due_on");

-- CreateIndex
CREATE INDEX "risk_treatment_actions_due_on_status_idx" ON "risk_treatment_actions"("due_on", "status");

-- CreateIndex
CREATE UNIQUE INDEX "controls_code_key" ON "controls"("code");

-- CreateIndex
CREATE UNIQUE INDEX "processes_code_key" ON "processes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "assets_code_key" ON "assets"("code");

-- CreateIndex
CREATE INDEX "risk_control_links_risk_id_idx" ON "risk_control_links"("risk_id");

-- CreateIndex
CREATE INDEX "risk_process_links_risk_id_idx" ON "risk_process_links"("risk_id");

-- CreateIndex
CREATE INDEX "risk_asset_links_risk_id_idx" ON "risk_asset_links"("risk_id");

-- data-model.md §10: "Partial unique: (riskId, controlId) WHERE unlinkedAt
-- IS NULL" — Prisma's schema language has no partial-index syntax (as of
-- this Prisma version), so this is hand-written, the same documented drift
-- pattern already established for `risk_methodologies_one_active_idx`
-- (`20260905150100_risk_assessment_methodology_baseline`). This is what
-- makes "linking an already-linked control returns 409" (contracts/
-- risks.openapi.yaml's `linkControlToRisk`) a real database guarantee, not
-- merely an application-level check that a race could slip past: two
-- concurrent requests linking the SAME (risk, control) pair can only ever
-- have one succeed at the database level.
CREATE UNIQUE INDEX "risk_control_links_risk_id_control_id_active_key" ON "risk_control_links"("risk_id", "control_id") WHERE "unlinked_at" IS NULL;

-- Same rationale as above, against `risk_process_links`.
CREATE UNIQUE INDEX "risk_process_links_risk_id_process_id_active_key" ON "risk_process_links"("risk_id", "process_id") WHERE "unlinked_at" IS NULL;

-- Same rationale as above, against `risk_asset_links`.
CREATE UNIQUE INDEX "risk_asset_links_risk_id_asset_id_active_key" ON "risk_asset_links"("risk_id", "asset_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "risk_treatment_decisions" ADD CONSTRAINT "risk_treatment_decisions_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_decisions" ADD CONSTRAINT "risk_treatment_decisions_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_decisions" ADD CONSTRAINT "risk_treatment_decisions_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "risk_treatment_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_actions" ADD CONSTRAINT "risk_treatment_actions_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_actions" ADD CONSTRAINT "risk_treatment_actions_treatment_decision_id_fkey" FOREIGN KEY ("treatment_decision_id") REFERENCES "risk_treatment_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_treatment_actions" ADD CONSTRAINT "risk_treatment_actions_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controls" ADD CONSTRAINT "controls_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_control_links" ADD CONSTRAINT "risk_control_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_process_links" ADD CONSTRAINT "risk_process_links_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_process_links" ADD CONSTRAINT "risk_process_links_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_process_links" ADD CONSTRAINT "risk_process_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_process_links" ADD CONSTRAINT "risk_process_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_asset_links" ADD CONSTRAINT "risk_asset_links_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_asset_links" ADD CONSTRAINT "risk_asset_links_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_asset_links" ADD CONSTRAINT "risk_asset_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_asset_links" ADD CONSTRAINT "risk_asset_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — the `risks.current_treatment_id` column already exists
-- (created plain, with no FK, by `20260905140100_risk_management_baseline`
-- — see that model's own header in schema.prisma for why it was deferred).
-- `risk_treatment_decisions` now exists, so the FK is added here.
ALTER TABLE "risks" ADD CONSTRAINT "risks_current_treatment_id_fkey" FOREIGN KEY ("current_treatment_id") REFERENCES "risk_treatment_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- `RiskTreatmentDecision` append-only enforcement (FR-073) — interpretive
-- decision, documented per this task's explicit instruction to justify it.
-- ---------------------------------------------------------------------------
--
-- DECISION: NOT a blanket `REVOKE UPDATE, DELETE` the way
-- `RiskMethodologyVersion` is (`20260905150100_risk_assessment_methodology_
-- baseline`). That table is NEVER updated by any application code path —
-- `PublishMethodologyVersionUseCase` only ever `create`s — so revoking the
-- privilege entirely removes every legitimate application code path that
-- could violate append-only-ness.
--
-- `risk_treatment_decisions` is different: FR-073 itself REQUIRES exactly
-- one legitimate mutation — "a new decision stamps `supersededAt` on the
-- previous one rather than overwriting it" (data-model.md §10). A blanket
-- `REVOKE UPDATE` would make `RecordTreatmentUseCase` (T139) unable to
-- perform the very operation FR-073 asks for. Revoking the privilege
-- entirely is therefore the WRONG mechanism here — it would not enforce
-- append-only-ness, it would make the feature inoperable.
--
-- Instead: a `BEFORE UPDATE OR DELETE` trigger — the same mechanism
-- `audit_event`'s own `audit_event_prevent_modification`
-- (`20260905120200_audit_event_append_only`) uses — narrowly scoped to
-- permit EXACTLY the one legitimate transition FR-073 describes, and reject
-- everything else, including:
--   - any `DELETE` (no delete path exists or should ever exist);
--   - an `UPDATE` that changes any business-content column (`risk_id`,
--     `strategy`, `description`, `deadline`, `decided_by_user_id`,
--     `decided_at`) — a decision, once decided, is a historical fact;
--   - an `UPDATE` that sets `superseded_at`/`superseded_by_id` on a row
--     that is ALREADY superseded (no double-supersession, no "unsuperseding"
--     by setting it back to NULL — `NEW.superseded_at IS NULL` is rejected
--     just as much as a second, different supersession would be);
--   - an `UPDATE` that leaves `superseded_at` NULL (i.e. touches the row for
--     any reason other than actually superseding it).
--
-- This gives FR-073 a REAL, database-enforced guarantee — not merely an
-- application convention — while still allowing the one write path the
-- requirement itself mandates. It is a stronger guarantee than
-- `RiskMethodologyVersion`'s (which permits zero updates) applied correctly
-- to a table that must permit exactly one: T133's integration test proves
-- the superseded row is unchanged in every OTHER column, and this trigger
-- is why that is guaranteed even if a future code path attempted a
-- different write.
CREATE OR REPLACE FUNCTION risk_treatment_decisions_prevent_overwrite() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'risk_treatment_decisions is append-only: DELETE is not permitted (row id %)', OLD.id;
    END IF;

    -- TG_OP = 'UPDATE' from here on.
    IF OLD.superseded_at IS NOT NULL THEN
        RAISE EXCEPTION 'risk_treatment_decisions row % is already superseded and cannot be modified again', OLD.id;
    END IF;

    IF NEW.superseded_at IS NULL THEN
        RAISE EXCEPTION 'risk_treatment_decisions row % may only be updated to set superseded_at (the FR-073 supersession stamp)', OLD.id;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.risk_id IS DISTINCT FROM OLD.risk_id
        OR NEW.strategy IS DISTINCT FROM OLD.strategy
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.deadline IS DISTINCT FROM OLD.deadline
        OR NEW.decided_by_user_id IS DISTINCT FROM OLD.decided_by_user_id
        OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
    THEN
        RAISE EXCEPTION 'risk_treatment_decisions row % is append-only: only superseded_at/superseded_by_id may change', OLD.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER risk_treatment_decisions_append_only
    BEFORE UPDATE OR DELETE ON "risk_treatment_decisions"
    FOR EACH ROW EXECUTE FUNCTION risk_treatment_decisions_prevent_overwrite();

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '248b79aa-3bcb-5fc5-836a-dee210e15f25',
    'a8873815637b7992507dbb7bed4dd0873b34cba096d4deaf92cfcc7e0284eded',
    CURRENT_TIMESTAMP,
    '20260905160100_risk_treatment_and_relationships_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905170000_audit_entity_type_add_risk_lifecycle
-- T153/US6 — Additive growth of the `AuditEntityType` enum: adds
-- `RISK_LIFECYCLE_TRANSITION` and `APPROVAL` (ADR-008: "closed platform
-- enums grow by reviewed migration"). Two distinct values rather than one
-- generic "lifecycle" value: a transition is an APPLIED state change, an
-- approval is a REQUEST/DECISION pair that may never result in a
-- transition at all (REJECTED clears the pending condition and leaves the
-- risk exactly where it was) — the same reasoning that gave the three risk
-- relationship link types their own distinct values
-- (`20260905160000_audit_entity_type_add_risk_treatment`).
--
-- ## The PostgreSQL restriction this migration must respect
--
-- Same restriction as every prior `audit_entity_type_add_*` migration (see
-- `20260905140000_audit_entity_type_add_risk`,
-- `20260905150000_audit_entity_type_add_risk_assessment_methodology`,
-- `20260905160000_audit_entity_type_add_risk_treatment` for the full
-- explanation): a value added by `ALTER TYPE ... ADD VALUE` cannot be
-- referenced by any statement in the SAME transaction that added it. This
-- migration contains only the two `ADD VALUE` statements and writes no
-- data using either new label — nor does the migration that runs
-- immediately after it
-- (`20260905170100_risk_lifecycle_and_approvals_baseline`), which only
-- creates tables/indexes/constraints/triggers and writes no `audit_event`
-- rows. The first real use of each new label is `AuditRecorder.record(...)`
-- called at normal application runtime, in an entirely separate
-- transaction opened long after `prisma migrate deploy` has committed this
-- one.
ALTER TYPE "AuditEntityType" ADD VALUE 'RISK_LIFECYCLE_TRANSITION';
ALTER TYPE "AuditEntityType" ADD VALUE 'APPROVAL';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '4d60725b-22fb-523b-88e8-f6291769d844',
    '66607e365ec9dd17ae25c069946dce8cffe5a22ba11a25a9b3a508ee80ed9746',
    CURRENT_TIMESTAMP,
    '20260905170000_audit_entity_type_add_risk_lifecycle',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905170100_risk_lifecycle_and_approvals_baseline
-- T153/US6 — Risk Lifecycle and Approvals baseline: `RiskLifecycleTransition`
-- and `Approval` (data-model.md §11, ADR-006, FR-029/FR-029a-d, FR-079 to
-- FR-085), plus the `risks.pending_approval_id` FK deferred from the US2
-- baseline migration (`20260905140100_risk_management_baseline` — see that
-- model's own header in schema.prisma).
--
-- Hand-written (never `prisma migrate dev` — see schema.prisma's header and
-- docs/local-environment.md), corresponding 1:1 to the models added to
-- schema.prisma in this same change, with the additions Prisma's schema
-- language cannot express: the `CHECK` constraint enforcing segregation of
-- duties at the database, the partial unique index limiting one PENDING
-- approval per entity, and `Approval`'s append-only enforcement trigger
-- (all documented at their own statements below).

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovableEntityType" AS ENUM ('RISK');

-- CreateTable
CREATE TABLE "risk_lifecycle_transitions" (
    "id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "from_status" "RiskStatus" NOT NULL,
    "to_status" "RiskStatus" NOT NULL,
    "performed_by_user_id" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ(6) NOT NULL,
    "justification" TEXT,
    "approval_id" UUID,

    CONSTRAINT "risk_lifecycle_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "entity_type" "ApprovableEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "requested_transition" TEXT NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "justification" TEXT,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_lifecycle_transitions_risk_id_performed_at_idx" ON "risk_lifecycle_transitions"("risk_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "approvals_status_entity_type_entity_id_idx" ON "approvals"("status", "entity_type", "entity_id");

-- CreateIndex — FR-029a database backstop against segregation-of-duties
-- violations: a self-decided approval can never be committed, regardless of
-- which application code path attempted it.
ALTER TABLE "approvals"
    ADD CONSTRAINT "approvals_decided_by_requester_check"
    CHECK ("decided_by_user_id" IS NULL OR "decided_by_user_id" <> "requested_by_user_id");

-- CreateIndex — data-model.md §11: "one PENDING approval per
-- (entityType, entityId)" (FR-029c's pending-condition rule, backstopping
-- `RequestApprovalUseCase`'s own application-level check with a real
-- database guarantee against a race between two simultaneous requests).
-- Prisma's schema language has no partial-index syntax, hence hand-written
-- SQL here rather than a `@@unique` in schema.prisma — the same documented
-- drift pattern as `risk_methodologies.is_active`'s own partial unique
-- index (`20260905150100_risk_assessment_methodology_baseline`) and the
-- three risk relationship link tables' "one active link" indexes
-- (`20260905160100_risk_treatment_and_relationships_baseline`).
CREATE UNIQUE INDEX "approvals_one_pending_per_entity"
    ON "approvals"("entity_type", "entity_id")
    WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "risk_lifecycle_transitions" ADD CONSTRAINT "risk_lifecycle_transitions_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_lifecycle_transitions" ADD CONSTRAINT "risk_lifecycle_transitions_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_lifecycle_transitions" ADD CONSTRAINT "risk_lifecycle_transitions_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — deliberately NO FK from `approvals.entity_id` to `risks`:
-- `entityType`/`entityId` is the documented polymorphic exception (ADR-008,
-- same shape as comments/attachments) so a future module's own approvable
-- entity type participates without a schema change to this table.
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — the `risks.pending_approval_id` column already exists
-- (created plain, with no FK, by `20260905140100_risk_management_baseline`
-- — see that model's own header in schema.prisma for why it was deferred).
-- `approvals` now exists, so the FK is added here.
ALTER TABLE "risks" ADD CONSTRAINT "risks_pending_approval_id_fkey" FOREIGN KEY ("pending_approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- `RiskLifecycleTransition` append-only enforcement (FR-083) — interpretive
-- decision, documented per this task's explicit instruction to justify it.
-- ---------------------------------------------------------------------------
--
-- DECISION: privilege revocation only (`RiskMethodologyVersion`'s precedent,
-- `20260905150100_risk_assessment_methodology_baseline`), NOT a trigger
-- (`RiskTreatmentDecision`'s precedent, `20260905160100_risk_treatment_and_
-- relationships_baseline`).
--
-- The choice between the two precedents turns on one question: does ANY
-- application code path ever need to UPDATE this table after the initial
-- INSERT? For `risk_treatment_decisions`, the answer is yes — FR-073
-- REQUIRES exactly one legitimate mutation (stamping `supersededAt` on the
-- row a new decision replaces), so a blanket `REVOKE UPDATE` would make the
-- feature itself inoperable and a trigger permitting exactly that one shape
-- of `UPDATE` is the only mechanism that enforces append-only-ness without
-- breaking the requirement.
--
-- `risk_lifecycle_transitions` has NO such requirement. A transition row
-- records "the risk moved from X to Y, performed by this user, at this
-- instant" — a historical fact that is complete and correct the moment it
-- is inserted (`PerformTransitionUseCase`/`DecideApprovalUseCase`, T156/
-- T157). No later event ever needs to revise a PAST transition's
-- `fromStatus`/`toStatus`/`performedByUserId`/`performedAt`/`justification`/
-- `approvalId` — unlike `risk_treatment_decisions`, there is no
-- "supersession" concept for a transition; the NEXT transition is simply a
-- NEW row. Revoking `UPDATE`/`DELETE` from `pharos_app` therefore removes
-- every legitimate application code path that could violate append-only-ness
-- (there are none to preserve), exactly matching `RiskMethodologyVersion`'s
-- own reasoning: "the application NEVER has a legitimate reason to UPDATE or
-- DELETE this table ... revoking the privilege from the ONE role that ever
-- connects as the running application removes every application code path
-- that could do it, by construction". A trigger would be a strictly
-- redundant SECOND backstop against the OWNER role running an ad hoc
-- statement directly — a real but narrower threat this migration accepts
-- the same way `RiskMethodologyVersion`'s own migration already accepted it
-- for the identical reason, not a table this platform's whole audit story
-- hinges on being intact (that distinction is `audit_event`'s alone,
-- ADR-005).
DO $$
DECLARE
    app_role text := (SELECT value FROM pharos_config WHERE key = 'app_role');
BEGIN
    IF app_role IS NULL THEN
        RAISE EXCEPTION 'pharos_config has no app_role row — cannot enforce risk_lifecycle_transitions append-only privileges';
    END IF;

    EXECUTE format('GRANT SELECT, INSERT ON %I TO %I', 'risk_lifecycle_transitions', app_role);
    EXECUTE format('REVOKE UPDATE, DELETE ON %I FROM %I', 'risk_lifecycle_transitions', app_role);
END;
$$;

-- ---------------------------------------------------------------------------
-- `Approval` append-only enforcement (FR-029b/FR-029c) — the OTHER half of
-- the same interpretive decision, resolved the OTHER way for the reason
-- explained above: this table DOES have exactly one legitimate mutation.
-- ---------------------------------------------------------------------------
--
-- A row is inserted `PENDING` (`RequestApprovalUseCase`, T157) and is
-- decided AT MOST once (`DecideApprovalUseCase`, T157): `status` moves to
-- `APPROVED` or `REJECTED`, and `decided_by_user_id`/`decided_at`/
-- `justification` are set together, in the SAME `UPDATE`. A blanket
-- `REVOKE UPDATE` would make deciding an approval impossible — the same
-- reasoning `risk_treatment_decisions_prevent_overwrite`'s own header gives
-- for why THAT table needed a trigger instead of a revocation. This trigger
-- follows that exact template, narrowly permitting:
--   - an `UPDATE` from `status = 'PENDING'` to `status IN ('APPROVED',
--     'REJECTED')`, that ALSO sets both `decided_by_user_id` and
--     `decided_at` (never one without the other), and leaves
--     `entity_type`/`entity_id`/`requested_transition`/
--     `requested_by_user_id`/`requested_at` untouched;
-- and rejecting everything else, including:
--   - any `DELETE` (no delete path exists or should ever exist — FR-029b's
--     "record each approval request and decision" is permanent);
--   - an `UPDATE` on a row that is ALREADY decided (`OLD.status <>
--     'PENDING'`) — no re-deciding, no changing a decision after the fact;
--   - an `UPDATE` that leaves `status = 'PENDING'` (i.e. touches the row for
--     any reason other than actually deciding it);
--   - an `UPDATE` that changes any of the request-side columns.
--
-- This gives FR-029b a REAL, database-enforced guarantee that a decision, once
-- recorded, is permanent — not merely an application convention — while
-- still allowing the one write path FR-029c's approval/rejection flow
-- requires. Combined with the `approvals_decided_by_requester_check`
-- constraint above, segregation of duties (FR-029a) and decision
-- immutability (FR-029b) both hold at the database level regardless of
-- which application code path attempts to violate them.
CREATE OR REPLACE FUNCTION approvals_prevent_overwrite() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'approvals is append-only: DELETE is not permitted (row id %)', OLD.id;
    END IF;

    -- TG_OP = 'UPDATE' from here on.
    IF OLD.status <> 'PENDING' THEN
        RAISE EXCEPTION 'approvals row % is already decided and cannot be modified again', OLD.id;
    END IF;

    IF NEW.status = 'PENDING' THEN
        RAISE EXCEPTION 'approvals row % may only be updated to record a decision (status APPROVED or REJECTED)', OLD.id;
    END IF;

    IF NEW.decided_by_user_id IS NULL OR NEW.decided_at IS NULL THEN
        RAISE EXCEPTION 'approvals row % must set decided_by_user_id and decided_at when recording a decision', OLD.id;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.entity_type IS DISTINCT FROM OLD.entity_type
        OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
        OR NEW.requested_transition IS DISTINCT FROM OLD.requested_transition
        OR NEW.requested_by_user_id IS DISTINCT FROM OLD.requested_by_user_id
        OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
    THEN
        RAISE EXCEPTION 'approvals row % is append-only: only status/decided_by_user_id/decided_at/justification may change, and only once', OLD.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approvals_append_only
    BEFORE UPDATE OR DELETE ON "approvals"
    FOR EACH ROW EXECUTE FUNCTION approvals_prevent_overwrite();

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '69be1795-040a-5635-b918-1e30e7a1a929',
    'ae34a501300742426554e709a0f8cc401fb1e48480a70bbf4be50a8066b95dff',
    CURRENT_TIMESTAMP,
    '20260905170100_risk_lifecycle_and_approvals_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905180000_audit_entity_type_add_collaboration
-- T187/US9 — Additive growth of the `AuditEntityType` enum: adds
-- `ATTACHMENT` and `COMMENT` (ADR-008: "closed platform enums grow by
-- reviewed migration"). Two distinct values, not one generic
-- "collaboration" value — a comment and an attachment are different
-- business facts with different audit field allow-lists
-- (`core/comments/domain/comments-audit-allowlist.ts`,
-- `core/files/domain/files-audit-allowlist.ts`), the same reasoning already
-- applied to every other cross-cutting capability's entities
-- (`20260905160000_audit_entity_type_add_risk_treatment`,
-- `20260905170000_audit_entity_type_add_risk_lifecycle`).
--
-- ## The PostgreSQL restriction this migration must respect
--
-- Same restriction as every prior `audit_entity_type_add_*` migration: a
-- value added by `ALTER TYPE ... ADD VALUE` cannot be referenced by any
-- statement in the SAME transaction that added it. This migration contains
-- only the two `ADD VALUE` statements and writes no data using either new
-- label — nor does the migration that runs immediately after it
-- (`20260905180100_collaboration_baseline`), which only creates
-- tables/enums/indexes and writes no `audit_event` rows. The first real use
-- of each new label is `AuditRecorder.record(...)` called at normal
-- application runtime, in an entirely separate transaction opened long
-- after `prisma migrate deploy` has committed this one.
ALTER TYPE "AuditEntityType" ADD VALUE 'ATTACHMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'COMMENT';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '7113e3eb-f056-5029-8fda-461c228cca6b',
    'fc76b2fb0d3e4d78d62bbfe17720891bf7838f3ed01109a6bf1842e436fa9365',
    CURRENT_TIMESTAMP,
    '20260905180000_audit_entity_type_add_collaboration',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260905180100_collaboration_baseline
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
-- UPDATE, DELETE — `database/postgres/init/01-roles.sql`) already cover.

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

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '4e2c9344-069c-518f-960a-d6d9c1ab6f90',
    '7948d7560e7d556b9c9c6ddf904d24efa0ad50d13a6f316c95af25e5d0fa9496',
    CURRENT_TIMESTAMP,
    '20260905180100_collaboration_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260906090000_audit_entity_type_add_probe
-- T206a — THROWAWAY PROBE (SC-011 verification, ADR-011). Additive growth of
-- three closed enums for `modules/_extensibility_probe/`'s own entity type,
-- exactly the pattern every other cross-cutting capability's entity types
-- already followed (`20260905180000_audit_entity_type_add_collaboration`,
-- etc.) — this is the one step ADR-008/`entity-registry.ts` document as
-- "not purely a code-level registration" for a future module.
--
-- Same PostgreSQL restriction as every prior `_add_*` migration: a value
-- added by `ALTER TYPE ... ADD VALUE` cannot be referenced by any statement
-- in the SAME transaction that added it. This migration only adds labels
-- and writes no row using any of them.
--
-- REVERSIBILITY NOTE (F-20-adjacent): PostgreSQL has no `ALTER TYPE ... DROP
-- VALUE`. Once T206a's probe module is removed, these three labels stay in
-- their enums permanently — recorded in docs/deferred-findings.md rather
-- than attempted as a live type-recreation against a database in active use.
ALTER TYPE "AuditEntityType" ADD VALUE 'PROBE_RECORD';
ALTER TYPE "AttachableEntityType" ADD VALUE 'PROBE_RECORD';
ALTER TYPE "CommentableEntityType" ADD VALUE 'PROBE_RECORD';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'b74f87c4-ebb8-5d9f-a90a-00d0b31c95fe',
    'f19b4ef1fe8d92e6ce2bb69dd447d721ce676e2f32efe9263127119b394c5fbc',
    CURRENT_TIMESTAMP,
    '20260906090000_audit_entity_type_add_probe',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260906090100_probe_record_baseline
-- T206a — THROWAWAY PROBE (SC-011 verification). `probe_records` is an
-- ordinary, fully mutable, non-append-only table (unlike
-- `risk_treatment_decisions`/`approvals` — see F-20): it carries no
-- `BEFORE UPDATE OR DELETE` trigger, so it can be genuinely dropped when the
-- probe module is removed, unlike the enum values added in the previous
-- migration. Default privileges already grant `pharos_app`
-- SELECT/INSERT/UPDATE/DELETE on any table `pharos_owner` creates (see
-- docs/local-environment.md's Database provisioning section) — no explicit
-- GRANT statement needed here, matching every other baseline migration.
CREATE TABLE "probe_records" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "probe_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "probe_records_org_unit_id_idx" ON "probe_records"("org_unit_id");

-- AddForeignKey
ALTER TABLE "probe_records" ADD CONSTRAINT "probe_records_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probe_records" ADD CONSTRAINT "probe_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'fbcd95cf-eaa2-578c-9125-b5cb6eff6992',
    '73dc7e2e365dfdb5efc980239ae3402f9d7ab464277934c4f698580659820b50',
    CURRENT_TIMESTAMP,
    '20260906090100_probe_record_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260906091500_probe_record_teardown
-- T206a — THROWAWAY PROBE (SC-011 verification) teardown. `probe_records`
-- carries no `BEFORE UPDATE OR DELETE` append-only trigger (unlike
-- `risk_treatment_decisions`/`approvals` — F-20), so it can be genuinely
-- dropped now that `modules/_extensibility_probe/` has been deleted.
--
-- What this migration does NOT and cannot do: remove the three enum labels
-- (`AuditEntityType.PROBE_RECORD`, `AttachableEntityType.PROBE_RECORD`,
-- `CommentableEntityType.PROBE_RECORD`) added by
-- `20260906090000_audit_entity_type_add_probe`. PostgreSQL has no
-- `ALTER TYPE ... DROP VALUE`; removing a label requires recreating the
-- whole enum type and repointing every column that uses it, which was
-- deliberately NOT attempted against a database in active use (F-20's own
-- caution: "never test a destructive-reset path for the first time against
-- a database someone is using"). Those three labels are permanent — see
-- docs/deferred-findings.md.
DROP TABLE "probe_records";

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'ab657811-cd1e-561b-91ef-064416f70cc0',
    '0dda0013ddecc36cb56bd149a60189dc62b84e6fd94bff69eba5d5a170a5652b',
    CURRENT_TIMESTAMP,
    '20260906091500_probe_record_teardown',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260906120000_probe_record_reintroduction
-- T206a — THROWAWAY PROBE (SC-011 re-verification), re-run. Reintroduces
-- `probe_records`, identical in shape to the first run's own
-- `20260906090100_probe_record_baseline` (dropped by
-- `20260906091500_probe_record_teardown`). It is an ordinary, fully mutable,
-- non-append-only table (unlike `risk_treatment_decisions`/`approvals` —
-- F-20): it carries no `BEFORE UPDATE OR DELETE` trigger, so it can be
-- genuinely dropped again when the probe module is removed. Default
-- privileges already grant `pharos_app` SELECT/INSERT/UPDATE/DELETE on any
-- table `pharos_owner` creates (docs/local-environment.md's Database
-- provisioning section) — no explicit GRANT needed here, matching every
-- other baseline migration. The three enum labels this table's columns
-- depend on (`AuditEntityType`/`AttachableEntityType`/`CommentableEntityType`
-- .`PROBE_RECORD`) already exist permanently from the first run — see
-- docs/deferred-findings.md F-22 (PostgreSQL has no `ALTER TYPE ... DROP
-- VALUE`), so no enum migration is needed this time.
CREATE TABLE "probe_records" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "probe_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "probe_records_org_unit_id_idx" ON "probe_records"("org_unit_id");

-- AddForeignKey
ALTER TABLE "probe_records" ADD CONSTRAINT "probe_records_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probe_records" ADD CONSTRAINT "probe_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '3ec0e8a0-1034-5685-ac2e-148f2966e4d4',
    '5a606bb36b6338a6e14ec51db843fb9b03979c4467fb6bb34ba3e6a483764875',
    CURRENT_TIMESTAMP,
    '20260906120000_probe_record_reintroduction',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260906130000_probe_record_reintroduction_teardown
-- T206a — THROWAWAY PROBE (SC-011 re-verification), second run, teardown.
-- `probe_records` carries no `BEFORE UPDATE OR DELETE` append-only trigger
-- (unlike `risk_treatment_decisions`/`approvals` — F-20), so it can be
-- genuinely dropped now that `modules/_extensibility_probe/` has been
-- deleted again. Mirrors the first run's own
-- `20260906091500_probe_record_teardown`.
--
-- What this migration does NOT and cannot do: remove the three enum labels
-- (`AuditEntityType.PROBE_RECORD`, `AttachableEntityType.PROBE_RECORD`,
-- `CommentableEntityType.PROBE_RECORD`) added by the FIRST run's
-- `20260906090000_audit_entity_type_add_probe`. PostgreSQL has no
-- `ALTER TYPE ... DROP VALUE` — those three labels were already permanent
-- before this second run started, and remain so. See
-- docs/deferred-findings.md F-22.
DROP TABLE "probe_records";

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '2600048c-6787-510b-816c-5d62961adfe6',
    '68c4da929703d4a7eeb356f846cb835f4b1b6e2c00403e3eae1ec712e0f82eef',
    CURRENT_TIMESTAMP,
    '20260906130000_probe_record_reintroduction_teardown',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907085000_permission_action_add_grc_foundation
-- T008/002-shared-grc-foundation — additive growth of the `PermissionAction`
-- enum: adds `LINK` and `CLOSE` (ADR-008: "closed platform enums grow by
-- reviewed migration"), the same pattern `ASSESS`/`TREAT`/`TRANSITION`
-- already established for a domain-specific verb outside the five default
-- CRUD actions.
--
-- `LINK` names `evidence:link` (`grc/evidence/domain/evidence-permissions.ts`
-- — `linkEvidence`/`unlinkEvidence`, contracts/grc-foundation.openapi.yaml).
-- `CLOSE` names `finding:close` (`grc/finding/domain/finding-permissions.ts`
-- — `closeFinding`, segregation-of-duties gated per FR-025, and its inverse
-- `reopenFinding`, which answers to the same authority per that
-- operation's own description).
--
-- ## The PostgreSQL restriction this migration must respect
--
-- Same restriction as every `*_add_*`-style enum-growth migration already
-- in this history (e.g. `20260905160000_audit_entity_type_add_risk_
-- treatment`): a value added by `ALTER TYPE ... ADD VALUE` cannot be
-- referenced by any statement in the SAME transaction that added it. This
-- migration contains only the two `ADD VALUE` statements and writes no
-- `permissions` row using either — the seed script
-- (`backend/seeds/platform.seed.ts`) upserts `permissions` rows in
-- an entirely separate transaction, run manually, long after `prisma
-- migrate deploy` has committed this one.
ALTER TYPE "PermissionAction" ADD VALUE 'LINK';
ALTER TYPE "PermissionAction" ADD VALUE 'CLOSE';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '16feff04-4836-5f5b-8354-248a1f26a5cc',
    '0c1ad8059e4d3c06bf882b1fe9fed009da6297d6beceb8f72a479cd395577e25',
    CURRENT_TIMESTAMP,
    '20260907085000_permission_action_add_grc_foundation',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907090000_audit_entity_type_add_grc_foundation
-- T010/002-shared-grc-foundation — additive growth of the `AuditEntityType`
-- enum: adds `EVIDENCE`, `EVIDENCE_LINK`, `ACTION`, `FINDING` (ADR-008:
-- "closed platform enums grow by reviewed migration"). Four distinct
-- values, not one generic "grc" value — the same reasoning already applied
-- to every other cross-cutting capability's entities
-- (`20260905180000_audit_entity_type_add_collaboration`,
-- `20260905170000_audit_entity_type_add_risk_lifecycle`): each is a
-- different business fact with its own audit field allow-list
-- (`grc/shared/domain/grc-audit-allowlist.ts`, T014), and a link
-- (`EVIDENCE_LINK`) is audited separately from the evidence it links, the
-- same way `RISK_CONTROL_LINK` is separate from `RISK`.
--
-- ## The PostgreSQL restriction this migration must respect
--
-- Same restriction as every prior `audit_entity_type_add_*` migration: a
-- value added by `ALTER TYPE ... ADD VALUE` cannot be referenced by any
-- statement in the SAME transaction that added it. This migration contains
-- only the four `ADD VALUE` statements and writes no data using any of
-- them — nor does the migration that runs immediately after it
-- (`20260907090100_grc_foundation_baseline`), which only creates
-- tables/enums/indexes/constraints and writes no `audit_event` rows. The
-- first real use of each new label is `AuditRecorder.record(...)` called
-- at normal application runtime, in an entirely separate transaction opened
-- long after `prisma migrate deploy` has committed this one.
ALTER TYPE "AuditEntityType" ADD VALUE 'EVIDENCE';
ALTER TYPE "AuditEntityType" ADD VALUE 'EVIDENCE_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'ACTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'FINDING';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'd0db1522-512f-56b3-aeaf-71d206b8cff0',
    '161ce3e8e52274f812a52e4e83e44035635bb906f18941f8c974d74ee89e3c50',
    CURRENT_TIMESTAMP,
    '20260907090000_audit_entity_type_add_grc_foundation',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907090100_grc_foundation_baseline
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

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '0084d8bf-309d-535c-87cf-2216c5335021',
    '42e468ad70d7d8316a0b136966c8cdc89a57d9dc2a829abdf76a4f7bb74c7504',
    CURRENT_TIMESTAMP,
    '20260907090100_grc_foundation_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907091000_attachable_entity_type_add_evidence
-- 002-shared-grc-foundation, US1 design correction — additive growth of
-- the `AttachableEntityType` enum: adds `EVIDENCE` (ADR-008: "closed
-- platform enums grow by reviewed migration"), the same growth pattern
-- `20260907090000_audit_entity_type_add_grc_foundation` already applied to
-- `AuditEntityType` for this same feature.
--
-- ## Why this migration exists, and why it is separate from the one after it
--
-- `Evidence.fileId` was implemented at T005/T007
-- (`20260907090100_grc_foundation_baseline`) as a real FK to
-- `Attachment.id`. That shape cannot work: `Attachment` requires its
-- parent to already exist (`UploadService`/
-- `getAttachableEntityAccessor(...).resolveViewableParent` resolves the
-- parent BEFORE the attachment row is created, throwing if it does not
-- exist), so `Evidence.file_id` was necessarily NULL at the moment an
-- evidence row is inserted — a column no `INSERT` could ever legally
-- populate. See `schema.prisma`'s own `Evidence` section header comment
-- for the full account.
--
-- The fix is to let evidence reach a file the SAME way `Risk` already
-- does: through the generic attachment mechanism, keyed by
-- `entityType`/`entityId`, created strictly AFTER the parent record
-- exists. That requires `EVIDENCE` to be a legal `AttachableEntityType`
-- value — this migration.
--
-- ## The PostgreSQL restriction this migration must respect
--
-- Same restriction as every prior `*_add_*`-style enum-growth migration in
-- this history: a value added by `ALTER TYPE ... ADD VALUE` cannot be
-- referenced by any statement in the SAME transaction that added it. This
-- migration contains only the one `ADD VALUE` statement and writes no
-- `attachments` row using it — nor does the migration that runs
-- immediately after it
-- (`20260907091100_evidence_file_fk_correction`), which only drops a
-- column/constraint and adds a new CHECK, writing no data. The first real
-- use of `EVIDENCE` is an actual `POST /attachments` call at normal
-- application runtime, in an entirely separate transaction opened long
-- after `prisma migrate deploy` has committed this one.
ALTER TYPE "AttachableEntityType" ADD VALUE 'EVIDENCE';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'f44f7c22-9622-58bf-b3f9-6d708dfa89f4',
    '49256e4035036a8a817f5af49367477b60489ade99ac83182a7035724635d06e',
    CURRENT_TIMESTAMP,
    '20260907091000_attachable_entity_type_add_evidence',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907091100_evidence_file_fk_correction
-- 002-shared-grc-foundation, US1 design correction (T017-T038) — corrects
-- `Evidence.fileId`, added at T005/T007
-- (`20260907090100_grc_foundation_baseline`) as a real FK to
-- `Attachment.id`. That combination could never work: `Attachment`
-- requires its parent to already exist before it can be created
-- (`UploadService`/`getAttachableEntityAccessor(...)
-- .resolveViewableParent` throws if the parent does not exist), so
-- `Evidence.file_id` was necessarily NULL at the moment an evidence row
-- is inserted — a column no `INSERT` could ever legally populate at the
-- instant `evidence_has_substance_check` (below) was evaluated. In
-- practice, the CHECK always forced `external_url` or `observation`, and
-- file-only evidence was impossible to create. See `schema.prisma`'s own
-- `Evidence` section header comment for the full account, and
-- `20260907091000_attachable_entity_type_add_evidence` (which MUST be
-- applied before this one) for the replacement mechanism: a file now
-- reaches evidence through the generic `Attachment` row
-- (`entity_type = 'EVIDENCE'`), created strictly AFTER the evidence row
-- exists — the only order that was ever going to work.
--
-- Additive in spirit even though it drops a column: `20260907090100_grc_
-- foundation_baseline` is already-applied history and is NOT edited (this
-- project's standing rule — hand-written SQL, `prisma migrate deploy`,
-- never editing a migration once applied). This is a NEW, later migration
-- that corrects course, the same way a future ADR would supersede an
-- earlier one rather than rewriting it.

-- Drop the FK, the CHECK that referenced `file_id`, and the column itself,
-- in dependency order. There was never a separate index on `file_id`
-- (confirmed against `schema.prisma`'s `Evidence`/`Attachment` models and
-- this table's own `CreateIndex` statements in the baseline migration —
-- only `evidence_org_unit_id_status_idx`, `evidence_valid_until_status_idx`
-- and `evidence_owner_user_id_status_idx` exist), so there is no index to
-- drop beyond the FK's own implicit constraint.
ALTER TABLE "evidence" DROP CONSTRAINT "evidence_has_substance_check";
ALTER TABLE "evidence" DROP CONSTRAINT "evidence_file_id_fkey";
ALTER TABLE "evidence" DROP COLUMN "file_id";

-- Invariant E1, narrowed (data-model.md §2, revised): "ao menos um de
-- external_url, observation preenchido" — `file_id` no longer participates
-- because it no longer exists on this table. This is a DELIBERATE
-- narrowing, not merely a mechanical follow-on of dropping the column:
-- evidence backed by a file (via the `Attachment` mechanism above) now
-- ALWAYS also carries at least a one-line `observation` describing what
-- the file shows — "penetration test report covering the admin API" is
-- more useful to an auditor than a bare filename — which is what keeps
-- FR-002's intent ("evidence is always readable by a human") enforceable
-- at the database, the same "the database is the last line" reasoning
-- already applied to `approvals_decided_by_requester_check`
-- (`20260905170100_risk_lifecycle_and_approvals_baseline`) and to this
-- same CHECK's original form.
ALTER TABLE "evidence"
    ADD CONSTRAINT "evidence_has_substance_check"
    CHECK ("external_url" IS NOT NULL OR "observation" IS NOT NULL);

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '57cc0789-d0d1-5290-9998-893a814fe348',
    'c33bc9441f38c65be4ed1336f0bf1b03b4783baa3f2f3389e6dcdc8490383d42',
    CURRENT_TIMESTAMP,
    '20260907091100_evidence_file_fk_correction',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907100000_pairing_invariant_check_constraints
-- Assurance fix (Fix 5, confirmed gap) — several "these two columns are
-- filled together or neither" invariants in schema.prisma's GRC Shared
-- Kernel section (Evidence's E3, EvidenceLink's L2, Action's A1 pairing
-- half, Finding's closed/archived pairing) were documented as
-- "domain-enforced" but enforced by nothing at the database: the guarantee
-- was only that one use case happened to write both columns together. This
-- adds real, additive, single-table CHECK constraints for exactly those
-- pairings, hand-written per this project's standing rule for constructs
-- Prisma's schema language cannot express (`@@check` does not exist in
-- this codebase's Prisma version usage — see schema.prisma's own section
-- header on Invariant E1/L1 for the identical reasoning already applied
-- once).
--
-- Deliberately NOT attempted here (left domain-enforced, per this fix's own
-- brief):
--   * Finding's F1 (closing requires a completed linked Action OR a
--     justification) — spans `actions`, a single-table CHECK cannot see it.
--   * Finding's F2 (segregation of duties: closedByUserId != any completed
--     linked Action's responsibleUserId) — spans `actions` too.
--   * Finding's F4 (only a CLOSED finding may be archived) — needs the
--     PREVIOUS status at the moment of the transition, which a CHECK
--     evaluated against the row's OWN current values cannot express.
--   * No upper bound is added to any risk-assessment probability/impact
--     scale — the ceiling depends on the methodology version in effect,
--     not a fixed constant (unrelated table, called out here only because
--     the brief that produced this migration explicitly named it as an
--     anti-goal).
--
-- Before writing this migration, every one of the four tables below was
-- checked against the running database for existing rows that would
-- violate the new constraint. All four returned zero:
--   SELECT count(*) FROM evidence       WHERE (archived_at IS NULL) <> (archived_by_user_id IS NULL);       -- 0
--   SELECT count(*) FROM evidence_links WHERE (unlinked_at IS NULL) <> (unlinked_by_user_id IS NULL);       -- 0
--   SELECT count(*) FROM actions        WHERE (completed_at IS NULL) <> (completed_by_user_id IS NULL);     -- 0
--   SELECT count(*) FROM actions        WHERE (status = 'COMPLETED') <> (completed_at IS NOT NULL);         -- 0
--   SELECT count(*) FROM actions        WHERE (reopened_at IS NULL) <> (reopened_by_user_id IS NULL);       -- 0
--   SELECT count(*) FROM findings       WHERE (closed_at IS NULL) <> (closed_by_user_id IS NULL);           -- 0
--   SELECT count(*) FROM findings       WHERE (archived_at IS NULL) <> (archived_by_user_id IS NULL);       -- 0
-- Had any of these been nonzero, this migration would have been withheld
-- and reported rather than shipped against real data it would fail on.

-- Invariant E3 — `evidence.archived_at`/`archived_by_user_id` paired.
ALTER TABLE "evidence"
    ADD CONSTRAINT "evidence_archived_pair_check"
    CHECK (("archived_at" IS NULL) = ("archived_by_user_id" IS NULL));

-- Invariant L2 — `evidence_links.unlinked_at`/`unlinked_by_user_id` paired.
ALTER TABLE "evidence_links"
    ADD CONSTRAINT "evidence_links_unlinked_pair_check"
    CHECK (("unlinked_at" IS NULL) = ("unlinked_by_user_id" IS NULL));

-- Invariant A1 — `actions.completed_at`/`completed_by_user_id` paired, AND
-- `completed_at` is set if and only if `status = 'COMPLETED'`. The second
-- clause is the exact rule schema.prisma's own Invariant A1 comment states
-- in words ("completedAt preenchido se e somente se status = COMPLETED");
-- both clauses are independent (the pairing could hold while the status
-- half is violated, e.g. a COMPLETED row with both columns null) and are
-- therefore two separate checks, not one.
ALTER TABLE "actions"
    ADD CONSTRAINT "actions_completed_pair_check"
    CHECK (("completed_at" IS NULL) = ("completed_by_user_id" IS NULL));
ALTER TABLE "actions"
    ADD CONSTRAINT "actions_completed_status_check"
    CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));

-- `actions.reopened_at`/`reopened_by_user_id` paired (no analogous status
-- co-constraint: reopening always transitions TO `OPEN`, but `OPEN` is also
-- an action's initial status pre-reopen, so `status = 'OPEN'` cannot imply
-- `reopened_at IS NOT NULL` the way `COMPLETED` implies `completed_at`).
ALTER TABLE "actions"
    ADD CONSTRAINT "actions_reopened_pair_check"
    CHECK (("reopened_at" IS NULL) = ("reopened_by_user_id" IS NULL));

-- `findings.closed_at`/`closed_by_user_id` paired (the pairing only — F1's
-- substantive "requires a completed action or justification" and F2's
-- segregation of duties are explicitly NOT attempted here, see this file's
-- header).
ALTER TABLE "findings"
    ADD CONSTRAINT "findings_closed_pair_check"
    CHECK (("closed_at" IS NULL) = ("closed_by_user_id" IS NULL));

-- `findings.archived_at`/`archived_by_user_id` paired (the pairing only —
-- F4's "only a CLOSED finding may be archived" is explicitly NOT attempted
-- here, see this file's header).
ALTER TABLE "findings"
    ADD CONSTRAINT "findings_archived_pair_check"
    CHECK (("archived_at" IS NULL) = ("archived_by_user_id" IS NULL));

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '10a24542-dac2-5be7-a42a-8c398632fa74',
    'b86a3dcdf911dc6242c4404a9a2ba29f8da965855b273e890ec5c24c261a11ae',
    CURRENT_TIMESTAMP,
    '20260907100000_pairing_invariant_check_constraints',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907100100_audit_event_prevent_truncate
-- Assurance fix (Fix 6, confirmed gap) — `audit_event`'s append-only
-- trigger (`audit_event_append_only`,
-- `20260905120200_audit_event_append_only`) is declared `BEFORE UPDATE OR
-- DELETE`. Live testing against a running instance confirmed the table
-- OWNER (`pharos_owner` — the application role `pharos_app` cannot even
-- reach `TRUNCATE`, since it was never granted that privilege in the first
-- place) can `TRUNCATE audit_event` in one statement, removing every row,
-- without that trigger ever firing: `UPDATE`/`DELETE` and `TRUNCATE` are
-- distinct trigger events in PostgreSQL, and a trigger declared for one
-- does not fire for the other.
--
-- This adds a `BEFORE TRUNCATE` trigger, reusing the SAME
-- `audit_event_prevent_modification()` function T028 already defined (it
-- unconditionally raises regardless of `TG_OP`, and never reads `NEW`/`OLD`
-- — both already true of the existing function, and both required for a
-- statement-level `TRUNCATE` trigger, which has no row to reference).
--
-- ## What this DOES and DOES NOT achieve — be precise
--
-- This closes an ACCIDENTAL or CARELESS `TRUNCATE audit_event`. It does
-- NOT stop a table owner who first runs `DROP TRIGGER` (or
-- `ALTER TABLE ... DISABLE TRIGGER`) and only then truncates — a trigger is
-- schema-level protection, not a privilege boundary, and `pharos_owner`
-- holds full DDL rights over its own tables by definition. This is
-- therefore NOT tamper-evidence and must never be described as such: it
-- raises the bar against a mistake, not against a determined and
-- privileged actor who chooses to remove the guard first. Real
-- tamper-evidence for `audit_event` would require a separate control
-- (e.g. an external WAL-shipped copy, or a superuser-owned trigger a
-- `pharos_owner` session cannot alter) — out of scope for this fix.
--
-- ## Partitioned table — a TRUNCATE trigger does NOT auto-cascade to partitions
--
-- `audit_event` is a partitioned table (`20260905120100_audit_event_
-- partitioning`). The ORIGINAL append-only migration's own comment notes,
-- and this fix's author independently re-verified, that a ROW-level
-- `BEFORE UPDATE OR DELETE` trigger declared on the partitioned PARENT is
-- automatically cloned to every existing and future partition. A
-- STATEMENT-level `BEFORE TRUNCATE` trigger is NOT: empirically verified
-- against a running instance (inside a transaction, rolled back — no data
-- was altered) that with the trigger declared ONLY on the parent,
-- `TRUNCATE audit_event_2026_09` (an existing partition, addressed
-- directly) still succeeded, and so did `TRUNCATE` on a BRAND-NEW
-- partition created by `create_audit_event_partition()` AFTER the parent
-- trigger already existed. This migration therefore does THREE things,
-- matching the exact per-partition discipline the original migration
-- already established for GRANT/REVOKE (which has the identical
-- non-cascading behavior, for the identical reason: partitions are
-- independent relations, not merely inherited view rows):
--
--   1. The trigger on the parent `audit_event` (blocks `TRUNCATE
--      audit_event` addressed by its own name).
--   2. The SAME trigger, explicitly, on every partition that exists today.
--   3. `create_audit_event_partition()` updated (`CREATE OR REPLACE`) to
--      create the SAME trigger on every partition it creates from now on,
--      so a future month's partition is covered without a further
--      migration.

-- 1. Parent.
CREATE TRIGGER audit_event_prevent_truncate
    BEFORE TRUNCATE ON "audit_event"
    FOR EACH STATEMENT
    EXECUTE FUNCTION audit_event_prevent_modification();

-- 2. Every partition that exists today — mirrors the GRANT/REVOKE loop in
-- `20260905120200_audit_event_append_only` exactly (same inheritance
-- query, same reasoning: this does NOT cascade automatically).
DO $$
DECLARE
    rec record;
BEGIN
    FOR rec IN
        SELECT c.relname
        FROM pg_inherits i
        JOIN pg_class c ON c.oid = i.inhrelid
        JOIN pg_class p ON p.oid = i.inhparent
        JOIN pg_namespace n ON n.oid = p.relnamespace
        WHERE p.relname = 'audit_event' AND n.nspname = 'public'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER audit_event_prevent_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION audit_event_prevent_modification()',
            rec.relname
        );
    END LOOP;
END;
$$;

-- 3. Every partition created from now on, via the SAME function T028
-- already established as the one path a partition can come into existence
-- through (`create_audit_event_partition()`, `pharos_owner`-only, no
-- scheduler invokes it automatically — ADR-015).
CREATE OR REPLACE FUNCTION create_audit_event_partition(target_month date)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
    partition_start date := (date_trunc('month', target_month))::date;
    partition_end   date := (date_trunc('month', target_month) + interval '1 month')::date;
    partition_name  text := format('audit_event_%s', to_char(partition_start, 'YYYY_MM'));
    app_role        text := (SELECT value FROM pharos_config WHERE key = 'app_role');
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name AND n.nspname = 'public' AND c.relkind IN ('r', 'p')
    ) THEN
        RETURN;
    END IF;

    EXECUTE format(
        'CREATE TABLE %I PARTITION OF "audit_event" FOR VALUES FROM (%L) TO (%L)',
        partition_name, partition_start, partition_end
    );

    -- Assurance fix (Fix 6) — the SAME `BEFORE TRUNCATE` guard the parent
    -- and every pre-existing partition now carry, added here so a
    -- partition created after this migration is never a gap. Unconditional
    -- (unlike the GRANT/REVOKE below, this needs no app-role name).
    EXECUTE format(
        'CREATE TRIGGER audit_event_prevent_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION audit_event_prevent_modification()',
        partition_name
    );

    IF app_role IS NOT NULL AND app_role <> '' THEN
        EXECUTE format('GRANT SELECT, INSERT ON %I TO %I', partition_name, app_role);
        EXECUTE format('REVOKE UPDATE, DELETE ON %I FROM %I', partition_name, app_role);
    END IF;
END;
$fn$;

COMMENT ON FUNCTION create_audit_event_partition(date) IS
    'Idempotently creates the monthly audit_event partition containing target_month, adds the SAME BEFORE TRUNCATE guard (Fix 6) the parent and every other partition carry, and grants the role named in pharos_config (key = ''app_role'') SELECT/INSERT while revoking UPDATE/DELETE on it, so FR-034 (append-only) holds for partitions created after today. Call ahead of need (an empty audit_event_default is the sign nothing is overdue). Must be run as pharos_owner. No scheduler invokes this automatically (ADR-015) — it is an operational or future-migration responsibility.';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'ac4e1061-9111-5c9a-bb4a-5992b5a58579',
    'fe63a932e69fd243ecec4e39d711c3404836d5bfa548cc13cc87e452d97929c3',
    CURRENT_TIMESTAMP,
    '20260907100100_audit_event_prevent_truncate',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907110000_controls_management_add_control_columns
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

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'b81f97b1-72b4-55d0-99de-6ada96580099',
    'f9668e87b975aca5d1b7238d89e4397d2592faae22681e9eef093702c646662e',
    CURRENT_TIMESTAMP,
    '20260907110000_controls_management_add_control_columns',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907110100_control_assessments_baseline
-- T002/003-controls-management — `control_assessments` (data-model.md §2):
-- the immutable effectiveness verification. Deliberately has NO
-- `updated_at` column — a new assessment succeeds the previous one;
-- nothing here is ever revised in place (FR-010). `approval_id` is the
-- attestation cycle, a nullable FK into the existing generic `approvals`
-- table (data-model.md §4, `ApprovableEntityType.CONTROL_ASSESSMENT`) —
-- no bespoke approval table is introduced.

-- CreateTable
CREATE TABLE "control_assessments" (
    "id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "assessed_on" DATE NOT NULL,
    "assessor_user_id" UUID NOT NULL,
    "result" "ControlAssessmentResult" NOT NULL,
    "conclusion" TEXT NOT NULL,
    "approval_id" UUID,
    "attested_at" TIMESTAMPTZ(6),
    "attested_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "control_assessments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "control_assessments" ADD CONSTRAINT "control_assessments_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_assessments" ADD CONSTRAINT "control_assessments_assessor_user_id_fkey" FOREIGN KEY ("assessor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_assessments" ADD CONSTRAINT "control_assessments_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_assessments" ADD CONSTRAINT "control_assessments_attested_by_user_id_fkey" FOREIGN KEY ("attested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex — the exact ordering `ControlEffectivenessService` walks
-- (most recent attested assessment first, data-model.md §2) and the
-- history view renders.
CREATE INDEX "control_assessments_control_id_assessed_on_created_at_idx" ON "control_assessments"("control_id", "assessed_on" DESC, "created_at" DESC);

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '9bdc0af6-7a2f-5a9d-892d-72d48c838e03',
    '20725e5fd32c705591ddb1c99de9e24917423eb2d984c9c86bdd21ff863fc395',
    CURRENT_TIMESTAMP,
    '20260907110100_control_assessments_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907110200_control_process_asset_links_baseline
-- T003/003-controls-management — `control_process_links`/
-- `control_asset_links` (data-model.md §5, ADR-020 part 1/2): explicit,
-- named links from a control to the process/asset it operates on, each
-- with real referential integrity (`onDelete: Restrict`). Same shape and
-- the same partial-unique-index technique as `risk_process_links`/
-- `risk_asset_links`
-- (`20260905160100_risk_treatment_and_relationships_baseline`) — hand-
-- written because Prisma's schema language has no partial-index syntax
-- (same documented drift pattern as that migration and
-- `risk_methodologies_one_active_idx`).

-- CreateTable
CREATE TABLE "control_process_links" (
    "id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "control_process_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_asset_links" (
    "id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "control_asset_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "control_process_links_control_id_idx" ON "control_process_links"("control_id");

-- CreateIndex
CREATE INDEX "control_asset_links_control_id_idx" ON "control_asset_links"("control_id");

-- data-model.md §5: "Unicidade parcial (control_id, process_id) WHERE
-- unlinked_at IS NULL — mesma técnica de RiskControlLink": impedes a
-- duplicate CURRENT link while allowing re-linking after withdrawal — the
-- same real, race-free database guarantee
-- `risk_control_links_risk_id_control_id_active_key` gives the risk side.
CREATE UNIQUE INDEX "control_process_links_control_id_process_id_active_key" ON "control_process_links"("control_id", "process_id") WHERE "unlinked_at" IS NULL;

-- Same rationale as above, against `control_asset_links`.
CREATE UNIQUE INDEX "control_asset_links_control_id_asset_id_active_key" ON "control_asset_links"("control_id", "asset_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "control_process_links" ADD CONSTRAINT "control_process_links_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_process_links" ADD CONSTRAINT "control_process_links_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_process_links" ADD CONSTRAINT "control_process_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_process_links" ADD CONSTRAINT "control_process_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_asset_links" ADD CONSTRAINT "control_asset_links_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_asset_links" ADD CONSTRAINT "control_asset_links_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_asset_links" ADD CONSTRAINT "control_asset_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_asset_links" ADD CONSTRAINT "control_asset_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '88d85d12-474a-543a-afed-4e12ebf3210f',
    'df4dc296a917cf8ec18e2b476816a2bce1eaeb612ef8fb2032b756413826b6e1',
    CURRENT_TIMESTAMP,
    '20260907110200_control_process_asset_links_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260907110300_closed_type_registries_add_control
-- T004/003-controls-management — additive growth of three existing closed
-- type registries (ADR-008: "closed platform enums grow by reviewed
-- migration"), the same growth pattern
-- `20260907091000_attachable_entity_type_add_evidence` already applied to
-- `AttachableEntityType`:
--
--   * `ApprovableEntityType` += `CONTROL_ASSESSMENT` (data-model.md §4) —
--     lets a `ControlAssessment`'s attestation cycle reuse the existing
--     generic `Approval` mechanism (research.md D-3).
--   * `EvidenceSubjectType` += `CONTROL` (data-model.md §7, FR-026) — lets
--     evidence attach to a control by the same closed-type mechanism every
--     other subject already uses.
--   * `ActionOriginType` += `CONTROL_ASSESSMENT` (data-model.md §7, FR-027,
--     research.md D-5) — the origin is the FACT that justifies remediation
--     (a failed verification), never the generic `CONTROL` entity itself.
--
-- All three are independent enum types with no cross-reference between
-- them, so they are grouped in one migration file/transaction. The
-- restriction this migration DOES respect (documented at length by the
-- precedent above): a value added by `ALTER TYPE ... ADD VALUE` cannot be
-- referenced by any statement in the SAME transaction that added it. This
-- migration contains only `ADD VALUE` statements and writes no row using
-- any of them — the first real use of each is at normal application
-- runtime, in an entirely separate transaction, long after `prisma migrate
-- deploy` has committed this one.
ALTER TYPE "ApprovableEntityType" ADD VALUE 'CONTROL_ASSESSMENT';
ALTER TYPE "EvidenceSubjectType" ADD VALUE 'CONTROL';
ALTER TYPE "ActionOriginType" ADD VALUE 'CONTROL_ASSESSMENT';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '75a8d4e5-f30a-57ef-8ca2-239a7d23e692',
    '88e202d08d76aa32cc3523ee447237b8db0906ede46e05e545e9f17d7529f55d',
    CURRENT_TIMESTAMP,
    '20260907110300_closed_type_registries_add_control',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908090000_audit_entity_type_add_control
-- T020/003-controls-management, User Story 1 — additive growth of the
-- `AuditEntityType` enum: adds `CONTROL` and `CONTROL_LIFECYCLE_TRANSITION`
-- (ADR-008: "closed platform enums grow by reviewed migration"). Two
-- distinct values, not one generic "control" value — a control's own
-- descriptive/ownership edit (`control.created`/`control.updated`) is a
-- different business fact from an applied lifecycle-state change
-- (`control.activated`/`control.suspended`/`control.retired`), the same
-- reasoning that already gave `RISK`/`RISK_LIFECYCLE_TRANSITION` their own
-- distinct values (`20260905170000_audit_entity_type_add_risk_lifecycle`).
--
-- The other Controls Management workstream (assessments, attestation,
-- process/asset links, operations 7-18 of contracts/controls.openapi.yaml)
-- registers its own further values (`CONTROL_ASSESSMENT`,
-- `CONTROL_PROCESS_LINK`, `CONTROL_ASSET_LINK`) separately, by its own
-- reviewed migration — deliberately not added here, out of this task's
-- scope.
--
-- ## The PostgreSQL restriction this migration must respect
--
-- Same restriction as every prior `audit_entity_type_add_*` migration: a
-- value added by `ALTER TYPE ... ADD VALUE` cannot be referenced by any
-- statement in the SAME transaction that added it. This migration contains
-- only the two `ADD VALUE` statements and writes no data using either new
-- label — nor does the migration that runs immediately after it
-- (`20260908090100_control_lifecycle_transitions_baseline`), which only
-- creates a table/index/FK/privilege-revocation and writes no
-- `audit_event` rows. The first real use of each new label is
-- `AuditRecorder.record(...)` called at normal application runtime, in an
-- entirely separate transaction opened long after `prisma migrate deploy`
-- has committed this one.
ALTER TYPE "AuditEntityType" ADD VALUE 'CONTROL';
ALTER TYPE "AuditEntityType" ADD VALUE 'CONTROL_LIFECYCLE_TRANSITION';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '55a99f3a-9e89-53cd-a5c4-b4fe45e09341',
    '09d626ebb0e1d47d81f60d08869dd3c7aa03cd1ec6e15b9f1692217f585b9d5b',
    CURRENT_TIMESTAMP,
    '20260908090000_audit_entity_type_add_control',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908090000_audit_entity_type_add_control_assessment_and_links
-- T036/003-controls-management, User Story 2/3 — additive growth of
-- `AuditEntityType` (ADR-008: "closed platform enums grow by reviewed
-- migration"), the same growth pattern
-- `20260907090000_audit_entity_type_add_grc_foundation` already applied for
-- EVIDENCE/EVIDENCE_LINK/ACTION/FINDING:
--
--   * `CONTROL_ASSESSMENT` — an assessment's own record and its attestation
--     decision (data-model.md §2/§4, FR-019, FR-020).
--   * `CONTROL_PROCESS_LINK` — the control-to-process relationship
--     (data-model.md §5, ADR-020 part 1).
--   * `CONTROL_ASSET_LINK` — the control-to-asset relationship (data-model.md
--     §5, ADR-020 part 1).
--
-- Three independent values with no cross-reference between them, so they are
-- grouped in one migration file/transaction — as `20260907110300_closed_type_
-- registries_add_control` already did for three unrelated closed-type
-- registries. The restriction that migration documented at length applies
-- here too: a value added by `ALTER TYPE ... ADD VALUE` cannot be referenced
-- by any statement in the SAME transaction that added it. This migration
-- contains only `ADD VALUE` statements and writes no row using any of them.
ALTER TYPE "AuditEntityType" ADD VALUE 'CONTROL_ASSESSMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'CONTROL_PROCESS_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'CONTROL_ASSET_LINK';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '228daf78-562a-5b23-9715-481b750b2734',
    '8393c9764d75c7672922a1797b7e6687730e599d7f4f95f7e1aeea12419fc518',
    CURRENT_TIMESTAMP,
    '20260908090000_audit_entity_type_add_control_assessment_and_links',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908090100_control_lifecycle_transitions_baseline
-- T020/003-controls-management, User Story 1 — `ControlLifecycleTransition`
-- baseline (D-6, FR-004). Genuine data-model gap found during
-- implementation: the contract's `getControlLifecycle`/`transitionControl`
-- operations (`contracts/controls.openapi.yaml`) reference a
-- `ControlLifecycleTransition` response schema, but `data-model.md` never
-- defines a table for it — an audit event alone does not satisfy a typed
-- history endpoint. Same shape as `risk_lifecycle_transitions`
-- (`20260905170100_risk_lifecycle_and_approvals_baseline`), minus
-- `approval_id`: Controls' lifecycle has no approval-gated transition
-- (research.md D-6's own "Descartado explicitamente: um estado
-- PENDING_APPROVAL").
--
-- Hand-written (never `prisma migrate dev` — see schema.prisma's header and
-- docs/local-environment.md), corresponding 1:1 to the
-- `ControlLifecycleTransition` model added to schema.prisma in this same
-- change.

-- CreateTable
CREATE TABLE "control_lifecycle_transitions" (
    "id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "from_status" "ControlStatus" NOT NULL,
    "to_status" "ControlStatus" NOT NULL,
    "performed_by_user_id" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ(6) NOT NULL,
    "justification" TEXT,

    CONSTRAINT "control_lifecycle_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "control_lifecycle_transitions_control_id_performed_at_idx" ON "control_lifecycle_transitions"("control_id", "performed_at" DESC);

-- AddForeignKey
ALTER TABLE "control_lifecycle_transitions" ADD CONSTRAINT "control_lifecycle_transitions_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_lifecycle_transitions" ADD CONSTRAINT "control_lifecycle_transitions_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Append-only enforcement — transcribed from `risk_lifecycle_transitions`'s
-- own migration (`20260905170100_risk_lifecycle_and_approvals_baseline`),
-- same reasoning applied identically: a transition row records "the
-- control moved from X to Y, performed by this user, at this instant" — a
-- historical fact complete and correct the moment it is inserted
-- (`PerformControlTransitionUseCase`). No later event ever needs to revise
-- a PAST transition's columns; the NEXT transition is simply a NEW row.
-- Privilege revocation (not a trigger) removes every legitimate
-- application code path that could violate append-only-ness, because there
-- is no legitimate `UPDATE`/`DELETE` path to preserve.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    app_role text := (SELECT value FROM pharos_config WHERE key = 'app_role');
BEGIN
    IF app_role IS NULL THEN
        RAISE EXCEPTION 'pharos_config has no app_role row — cannot enforce control_lifecycle_transitions append-only privileges';
    END IF;

    EXECUTE format('GRANT SELECT, INSERT ON %I TO %I', 'control_lifecycle_transitions', app_role);
    EXECUTE format('REVOKE UPDATE, DELETE ON %I FROM %I', 'control_lifecycle_transitions', app_role);
END;
$$;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '0d4a06e7-25f1-5054-971e-940d8b697971',
    '50e3985d83ba9e7eec8e731055eac2cf09c0847684e6afda27c75e2a7cea588d',
    CURRENT_TIMESTAMP,
    '20260908090100_control_lifecycle_transitions_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908100000_audit_entity_type_add_compliance
-- T007/004-compliance-management — additive growth of `AuditEntityType`
-- (ADR-008: "closed platform enums grow by reviewed migration"), the same
-- growth pattern `20260907090000_audit_entity_type_add_grc_foundation` and
-- `20260908090000_audit_entity_type_add_control_assessment_and_links`
-- already applied. Seven distinct values, one per business fact this
-- module's contract names (FR-025, data-model.md §9) — never one generic
-- "compliance" value:
--
--   * `FRAMEWORK` — a framework's own descriptive fields (create/update).
--   * `FRAMEWORK_VERSION` — a version's own fields, including the
--     DRAFT->PUBLISHED status transition (research.md D-3: captured as a
--     field change on this same type, not a separate lifecycle-transition
--     type — unlike CONTROL_LIFECYCLE_TRANSITION, because this lifecycle
--     has exactly one edge, firing at most once per version).
--   * `REQUIREMENT` — a clause's own fields (create/update while DRAFT).
--   * `REQUIREMENT_CONTROL_LINK` — the requirement<->control mapping
--     (link/unlink), data-model.md §4, ADR-020 part 1 (US2, out of this
--     migration's own workstream scope — schema-only here).
--   * `REQUIREMENT_CONTROL_MAPPING_MIGRATION` — one event per migration
--     execution, never one per copied link (SC-004, data-model.md §5).
--   * `REQUIREMENT_APPLICABILITY` — a not-applicable declaration and its
--     revocation (data-model.md §6).
--   * `REQUIREMENT_COMPLIANCE_STATE` — a compliance-state change, audited
--     at observation time (research.md D-11, data-model.md §7).
--
-- Grouped in one migration/transaction, as `20260907110300_closed_type_
-- registries_add_control` and `20260908090000_audit_entity_type_add_
-- control_assessment_and_links` already did for their own unrelated-but-
-- co-shipped values. A value added by `ALTER TYPE ... ADD VALUE` cannot be
-- referenced by any statement in the SAME transaction that added it — this
-- migration contains only `ADD VALUE` statements and writes no row using
-- any of them.
ALTER TYPE "AuditEntityType" ADD VALUE 'FRAMEWORK';
ALTER TYPE "AuditEntityType" ADD VALUE 'FRAMEWORK_VERSION';
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUIREMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUIREMENT_CONTROL_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUIREMENT_CONTROL_MAPPING_MIGRATION';
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUIREMENT_APPLICABILITY';
ALTER TYPE "AuditEntityType" ADD VALUE 'REQUIREMENT_COMPLIANCE_STATE';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '9a57c6d3-c4c6-54f6-aa7f-6c9eaa25bdcb',
    'a042279fa9cfd26d1ce47b453cd2a6f68bf0036305159a5fbcd802706ac9e0bf',
    CURRENT_TIMESTAMP,
    '20260908100000_audit_entity_type_add_compliance',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908100100_compliance_framework_baseline
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

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'b706c608-48cb-58b2-b7dc-802e94580efb',
    '3f6b3d7285c675dea70a754c7da965646cdb3fc79227417f981aa82ee1f73b7f',
    CURRENT_TIMESTAMP,
    '20260908100100_compliance_framework_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908100200_compliance_requirement_control_link_baseline
-- T002/004-compliance-management — `requirement_control_links`, the
-- explicit N:M mapping between a requirement and the controls that satisfy
-- it (data-model.md §4, ADR-017, ADR-020). Same shape and partial-unique-
-- index technique as `control_process_links`/`control_asset_links`
-- (`20260907110200_control_process_asset_links_baseline`) — hand-written
-- because Prisma's schema language has no partial-index syntax.
--
-- Real FK to `controls` (ADR-020 part 2): integrity at the database level,
-- while the module boundary (no `modules/compliance` import of
-- `modules/controls`) stays a code-level concept, verified by
-- `compliance-controls-risk-module-boundary.spec.ts` (research.md D-9,
-- D-10).
--
-- Schema-only in this migration: the domain/application/presentation code
-- that writes this table is User Story 2 (out of this workstream's own
-- scope) — this table exists now so Fase 1 ships every table the feature
-- needs in one reviewed pass (tasks.md Fase 1).

-- CreateTable
CREATE TABLE "requirement_control_links" (
    "id" UUID NOT NULL,
    "requirement_id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "requirement_control_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex — the compliance-state batch read (data-model.md §4: "é o
-- que o cálculo de conformidade em lote percorre").
CREATE INDEX "requirement_control_links_control_id_active_idx" ON "requirement_control_links"("control_id") WHERE "unlinked_at" IS NULL;

-- CreateIndex
CREATE INDEX "requirement_control_links_requirement_id_idx" ON "requirement_control_links"("requirement_id");

-- data-model.md §4: "Unicidade parcial (requirement_id, control_id) WHERE
-- unlinked_at IS NULL" — impedes a duplicate CURRENT link while allowing
-- re-linking after withdrawal, the same technique
-- `control_process_links_control_id_process_id_active_key` already uses.
CREATE UNIQUE INDEX "requirement_control_links_requirement_id_control_id_active_key" ON "requirement_control_links"("requirement_id", "control_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "requirement_control_links" ADD CONSTRAINT "requirement_control_links_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_control_links" ADD CONSTRAINT "requirement_control_links_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_control_links" ADD CONSTRAINT "requirement_control_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_control_links" ADD CONSTRAINT "requirement_control_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '602050b9-114f-51e2-b64d-6fd1462d9f46',
    '20e03d7e920c7ff8f57da4671a0daf996ea6884c5b0df78a8ec747583d5a0370',
    CURRENT_TIMESTAMP,
    '20260908100200_compliance_requirement_control_link_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908100300_compliance_mapping_migration_baseline
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

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'a52e86ba-61b9-51b2-b271-9bfcadc2e89b',
    '67abd11f0ac72a71e2c5d1e06e4627947c0b1c1300fb0b0ce799c1337b6f87f2',
    CURRENT_TIMESTAMP,
    '20260908100300_compliance_mapping_migration_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908100400_compliance_applicability_baseline
-- T004/004-compliance-management — `requirement_applicability_declarations`
-- (data-model.md §6, research.md D-7): a not-applicable declaration is a
-- succession of events, never a rewritten flag — the same partial-unique-
-- index technique as `requirement_control_links`/`control_process_links`.
-- Schema-only in this migration — the domain/application/presentation code
-- that writes this table is User Story 3 (out of this workstream's own
-- scope).

-- CreateTable
CREATE TABLE "requirement_applicability_declarations" (
    "id" UUID NOT NULL,
    "requirement_id" UUID NOT NULL,
    "justification" TEXT NOT NULL,
    "declared_at" TIMESTAMPTZ(6) NOT NULL,
    "declared_by_user_id" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_user_id" UUID,

    CONSTRAINT "requirement_applicability_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirement_applicability_declarations_requirement_id_idx" ON "requirement_applicability_declarations"("requirement_id");

-- data-model.md §6: "Unicidade parcial (requirement_id) WHERE revoked_at
-- IS NULL — no máximo uma declaração vigente por requisito".
CREATE UNIQUE INDEX "requirement_applicability_declarations_requirement_id_active_key" ON "requirement_applicability_declarations"("requirement_id") WHERE "revoked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "requirement_applicability_declarations" ADD CONSTRAINT "requirement_applicability_declarations_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_applicability_declarations" ADD CONSTRAINT "requirement_applicability_declarations_declared_by_fkey" FOREIGN KEY ("declared_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_applicability_declarations" ADD CONSTRAINT "requirement_applicability_declarations_revoked_by_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '2c1c2365-bbb3-540b-83b7-85e86a0a197a',
    '46c8524b45f83528d0e63c5b615c19c0d94dd93f3ccc26c19e1e311aeaaf590f',
    CURRENT_TIMESTAMP,
    '20260908100400_compliance_applicability_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908100500_compliance_compliance_state_baseline
-- T005/004-compliance-management — `requirement_compliance_audit_marks`
-- (data-model.md §7, research.md D-11): NOT the compliance-state column
-- FR-017/§19.7 forbid. It stores only the last OBSERVED value, one row per
-- requirement, written exclusively as the side effect of the
-- observation-time comparison that decides whether to emit a
-- `REQUIREMENT_COMPLIANCE_STATE` audit event (User Story 3, out of this
-- workstream's own scope — schema-only here). No operation in this API
-- ever reads this table to answer "what is the current state" — that is
-- always `RequirementComplianceService`, recomputed from source data.

-- CreateEnum
CREATE TYPE "RequirementComplianceState" AS ENUM ('NOT_APPLICABLE', 'NOT_MET', 'NOT_PROVEN', 'PARTIALLY_MET', 'COMPLIANT');

-- CreateTable
CREATE TABLE "requirement_compliance_audit_marks" (
    "requirement_id" UUID NOT NULL,
    "last_audited_state" "RequirementComplianceState" NOT NULL,
    "last_audited_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "requirement_compliance_audit_marks_pkey" PRIMARY KEY ("requirement_id")
);

-- AddForeignKey
ALTER TABLE "requirement_compliance_audit_marks" ADD CONSTRAINT "requirement_compliance_audit_marks_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '33c8bf48-968d-55c6-8699-5d7eb8ebfc65',
    '8cb808b8557a890754e91ffeeae7b0615ca8100595dc6d38304ae65a5fe2385f',
    CURRENT_TIMESTAMP,
    '20260908100500_compliance_compliance_state_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908100600_compliance_requirement_immutability_trigger
-- T006/004-compliance-management — `requirements_immutable_after_publish`
-- (data-model.md §3, research.md D-4, FR-004): a published requirement is
-- immutable, enforced by a database trigger IN ADDITION to the application
-- check every use case performs — not instead of it. Mirrors
-- `approvals_prevent_overwrite()`
-- (`20260905170100_risk_lifecycle_and_approvals_baseline/migration.sql`),
-- the only other trigger in this schema whose whole job is "after an
-- event, this row never changes again".
--
-- Unlike `approvals_prevent_overwrite` (which inspects only the row being
-- updated), this function must look at the PARENT `framework_versions`
-- row's `status` — `NEW.framework_version_id`/`OLD.framework_version_id`
-- never diverge (a requirement never migrates to a different version), so
-- either may be used; `OLD` is used below since it is guaranteed to exist
-- for every `UPDATE`. More expensive than a self-contained check (one
-- subquery per attempted `UPDATE`), accepted deliberately (research.md
-- D-4's own "mais cara que a checagem self-contida de approvals, mas o
-- mesmo princípio").
--
-- No `DELETE` guard: `requirements` is never hard-deleted by any operation
-- of this contract (data-model.md §3, "não hard-deletado") — a stricter
-- append-only guard mirroring `approvals`' own `DELETE` rejection is not
-- requested by any FR and would be an unrequested restriction (CLAUDE.md
-- §2). Restricting `DELETE` here would also be redundant: no code path
-- ever attempts one.
CREATE OR REPLACE FUNCTION requirements_prevent_update_after_publish() RETURNS trigger AS $$
DECLARE
    parent_status "FrameworkVersionStatus";
BEGIN
    SELECT "status" INTO parent_status
    FROM "framework_versions"
    WHERE "id" = OLD."framework_version_id";

    IF parent_status = 'PUBLISHED' THEN
        RAISE EXCEPTION 'requirement % belongs to a PUBLISHED framework version and is immutable', OLD.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER requirements_immutable_after_publish
    BEFORE UPDATE ON "requirements"
    FOR EACH ROW EXECUTE FUNCTION requirements_prevent_update_after_publish();

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '1aa40c30-2fe3-5994-a65e-3cf6fa3a5e79',
    '8574da92743987f1839239d910df189f8d37c8fd9c508808262acefd110aefe7',
    CURRENT_TIMESTAMP,
    '20260908100600_compliance_requirement_immutability_trigger',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908110000_audit_entity_type_add_audit_findings
-- T005/005-audit-findings — additive growth of `AuditEntityType`
-- (ADR-008: "closed platform enums grow by reviewed migration"), the same
-- growth pattern `20260908100000_audit_entity_type_add_compliance` and
-- every prior enum-growth migration already applied. Six distinct values,
-- one per business fact this module's contract names (FR-020,
-- data-model.md §8) — never one generic value:
--
--   * `AUDIT_ENGAGEMENT` — the engagement's own descriptive fields and all
--     four lifecycle transitions (start/complete/cancel), captured as a
--     field change on this same type (research.md D-3's own reasoning for
--     `FRAMEWORK_VERSION`: few, linear, at-most-once edges).
--   * `AUDIT_SCOPE_FRAMEWORK_VERSION` / `AUDIT_SCOPE_REQUIREMENT` /
--     `AUDIT_SCOPE_CONTROL` — one value per scope-link kind (data-model.md
--     §2-§4), the same reasoning `RISK_CONTROL_LINK`/`RISK_PROCESS_LINK`/
--     `RISK_ASSET_LINK` already established.
--   * `FINDING_CONTROL_LINK` / `FINDING_RISK_LINK` — the two `Finding`
--     relationships Phase 1 deferred (data-model.md §5-§6, ADR-020 parts
--     1/2), owned by `grc/finding` — grouped in the same reviewed
--     migration because they are unrelated-but-co-shipped values, the same
--     precedent `20260908090000_audit_entity_type_add_control_assessment_
--     and_links` already set.
--
-- A value added by `ALTER TYPE ... ADD VALUE` cannot be referenced by any
-- statement in the SAME transaction that added it — this migration
-- contains only `ADD VALUE` statements and writes no row using any of them.
ALTER TYPE "AuditEntityType" ADD VALUE 'AUDIT_ENGAGEMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'AUDIT_SCOPE_FRAMEWORK_VERSION';
ALTER TYPE "AuditEntityType" ADD VALUE 'AUDIT_SCOPE_REQUIREMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'AUDIT_SCOPE_CONTROL';
ALTER TYPE "AuditEntityType" ADD VALUE 'FINDING_CONTROL_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'FINDING_RISK_LINK';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '51200d0f-1954-5f65-b6b3-a7441aee6b43',
    '33fedd72e6b514a3220bf0af7f8ca7fe9a36cf7d18a91c2834bd71503bc28268',
    CURRENT_TIMESTAMP,
    '20260908110000_audit_entity_type_add_audit_findings',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908110100_audit_engagement_baseline
-- T001/005-audit-findings — `AuditEngagementStatus` and `audit_engagements`
-- (data-model.md §1), amended at the analysis gate to include the fourth
-- state `CANCELLED` and its `cancelled_at`/`cancelled_by_user_id`/
-- `cancellation_justification` columns (FR-004a — the discard path that
-- keeps an engagement opened by mistake, or abandoned before it has scope,
-- from being stuck forever; see the model's own doc comment in
-- schema.prisma). Purely additive — no existing table changes shape.
-- SQL below is `prisma migrate diff`-generated (naming matches the schema
-- exactly), split out of the full-feature diff into this table's own
-- migration.

-- CreateEnum
CREATE TYPE "AuditEngagementStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "audit_engagements" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "lead_auditor_user_id" UUID NOT NULL,
    "status" "AuditEngagementStatus" NOT NULL DEFAULT 'PLANNING',
    "started_at" TIMESTAMPTZ(6),
    "started_by_user_id" UUID,
    "completed_at" TIMESTAMPTZ(6),
    "completed_by_user_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_user_id" UUID,
    "cancellation_justification" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "audit_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_engagements_code_key" ON "audit_engagements"("code");

-- CreateIndex — data-model.md §1's own "meus engajamentos em execução".
CREATE INDEX "audit_engagements_org_unit_id_status_idx" ON "audit_engagements"("org_unit_id", "status");

-- CreateIndex
CREATE INDEX "audit_engagements_lead_auditor_user_id_idx" ON "audit_engagements"("lead_auditor_user_id");

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_lead_auditor_user_id_fkey" FOREIGN KEY ("lead_auditor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_started_by_user_id_fkey" FOREIGN KEY ("started_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_engagements" ADD CONSTRAINT "audit_engagements_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '646cd525-a5e3-5bab-b407-13ce3a5701e7',
    '8ed8c51d08c0ca0d7a2a3091a458b26487c799b21600143c602fc3f71161616d',
    CURRENT_TIMESTAMP,
    '20260908110100_audit_engagement_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908110200_audit_scope_baseline
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

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'b5175bd9-7449-5006-b62e-d89e957e2a52',
    '6e192047afec4b4da516634b3f1203675e062964a9b973e6c7b614cdcffa752d',
    CURRENT_TIMESTAMP,
    '20260908110200_audit_scope_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908110300_finding_control_risk_links_baseline
-- T003/005-audit-findings — `finding_control_links` and `finding_risk_links`
-- (data-model.md §5-§6), the two `Finding` relationships Phase 1 deferred
-- (ADR-020 parts 1/2). Same shape as `RiskControlLink`. Purely additive —
-- schema-only in this migration; the domain/application/presentation code
-- that writes these tables is Fase 5/User Story 3 (out of this task's own
-- scope). SQL below is `prisma migrate diff`-generated, plus two
-- hand-written partial unique indexes Prisma's schema language cannot
-- express (documented drift, same pattern as
-- `requirement_control_links_requirement_id_control_id_active_key`).

-- CreateTable
CREATE TABLE "finding_control_links" (
    "id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "finding_control_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finding_control_links_finding_id_unlinked_at_idx" ON "finding_control_links"("finding_id", "unlinked_at");

-- data-model.md §5: "Índice parcial único (finding_id, control_id) WHERE
-- unlinked_at IS NULL" — impedes a duplicate CURRENT link while allowing
-- re-linking after withdrawal, the same technique
-- `requirement_control_links_requirement_id_control_id_active_key`
-- already uses. Hand-written: Prisma's schema language has no partial-
-- index syntax.
CREATE UNIQUE INDEX "finding_control_links_finding_id_control_id_active_key" ON "finding_control_links"("finding_id", "control_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "finding_control_links" ADD CONSTRAINT "finding_control_links_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_control_links" ADD CONSTRAINT "finding_control_links_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_control_links" ADD CONSTRAINT "finding_control_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_control_links" ADD CONSTRAINT "finding_control_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "finding_risk_links" (
    "id" UUID NOT NULL,
    "finding_id" UUID NOT NULL,
    "risk_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "unlinked_at" TIMESTAMPTZ(6),
    "unlinked_by_user_id" UUID,

    CONSTRAINT "finding_risk_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finding_risk_links_finding_id_unlinked_at_idx" ON "finding_risk_links"("finding_id", "unlinked_at");

-- data-model.md §6: same partial-unique technique as above, against
-- (finding_id, risk_id).
CREATE UNIQUE INDEX "finding_risk_links_finding_id_risk_id_active_key" ON "finding_risk_links"("finding_id", "risk_id") WHERE "unlinked_at" IS NULL;

-- AddForeignKey
ALTER TABLE "finding_risk_links" ADD CONSTRAINT "finding_risk_links_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_risk_links" ADD CONSTRAINT "finding_risk_links_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_risk_links" ADD CONSTRAINT "finding_risk_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_risk_links" ADD CONSTRAINT "finding_risk_links_unlinked_by_user_id_fkey" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'b7bb7472-e623-5e57-8d25-61561efe326d',
    '63603632ce637d88cdb13ec21b2c79ad296c0756d57c457e1d13b0d4f81e0ee4',
    CURRENT_TIMESTAMP,
    '20260908110300_finding_control_risk_links_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908110400_findings_add_audit_engagement_id
-- T004/005-audit-findings — additive column on `findings` (data-model.md
-- §7, FR-007/FR-008): `audit_engagement_id`, nullable — `null` for every
-- achado manual (unchanged Fase 1 path); filled ONLY by
-- `POST /audits/{auditId}/findings`. No other column of `findings` changes
-- shape, nulidade or type (SC-007). SQL below is `prisma migrate diff`-
-- generated.

-- AlterTable
ALTER TABLE "findings" ADD COLUMN "audit_engagement_id" UUID;

-- CreateIndex
CREATE INDEX "findings_audit_engagement_id_idx" ON "findings"("audit_engagement_id");

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_audit_engagement_id_fkey" FOREIGN KEY ("audit_engagement_id") REFERENCES "audit_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '92b4093f-1861-5ca3-8a26-11596ce3be09',
    '09beee836a9264524b66ab8913e585b2ae75ac8d55d8029e9bf1776b72798c5c',
    CURRENT_TIMESTAMP,
    '20260908110400_findings_add_audit_engagement_id',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260908120000_audit_entity_type_add_asset_process
-- T001/006-assets-processes — additive growth of `AuditEntityType` (ADR-008:
-- "closed platform enums grow by reviewed migration"), the same growth
-- pattern `20260908110000_audit_entity_type_add_audit_findings` and every
-- prior enum-growth migration already applied. Two distinct values, not one
-- generic "registry" value — the same reasoning already given for every
-- other cross-cutting group above (`RISK_ASSET_LINK`/`RISK_PROCESS_LINK`,
-- `CONTROL_ASSET_LINK`/`CONTROL_PROCESS_LINK`, ...): `ASSET` and `PROCESS`
-- are different business facts with their own field allow-lists
-- (`modules/assets/domain/asset-audit-allowlist.ts`,
-- `modules/processes/domain/process-audit-allowlist.ts`).
--
-- `Asset` and `Process` are pre-existing tables (data-model.md §1) — this is
-- the ONLY schema change this fase makes to them, and it touches neither:
-- no column of `assets`/`processes` (or of `risk_asset_links`/
-- `risk_process_links`/`control_asset_links`/`control_process_links`)
-- changes type, nullability or name. The four values covering the
-- Risk/Control relationship to Asset/Process already exist
-- (`RISK_ASSET_LINK`, `RISK_PROCESS_LINK`, `CONTROL_ASSET_LINK`,
-- `CONTROL_ASSET_LINK`); what was missing was a type for the RECORD itself,
-- because until this fase no operation ever created or altered one
-- (research.md D-8).
--
-- A value added by `ALTER TYPE ... ADD VALUE` cannot be referenced by any
-- statement in the SAME transaction that added it — this migration contains
-- only `ADD VALUE` statements and writes no row using either of them.
ALTER TYPE "AuditEntityType" ADD VALUE 'ASSET';
ALTER TYPE "AuditEntityType" ADD VALUE 'PROCESS';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '59e11ad9-b29f-5352-96f1-733f74e5a4a9',
    '4d256c08a476934c37841acc4114fdd22ad5717e611ff0982a64d04d6e7e0fd2',
    CURRENT_TIMESTAMP,
    '20260908120000_audit_entity_type_add_asset_process',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260911000000_action_convergence_risk_treatment_actions
-- 007-implementation-remediation, Frente A, D-1/D-6 (research.md) — the
-- Action convergence. `risk_treatment_actions` stops being the authority for
-- title/description/responsible/dueOn/status/completedAt and becomes a pure
-- link row to the shared `Action` (`grc/action`). Forward-only,
-- aditiva-depois-destrutiva, in ONE transaction: if the verification step
-- (step 2) finds any discrepancy, the whole migration rolls back and the
-- DROP in step 3 never executes.
--
-- Every existing `risk_treatment_actions.id` is preserved (audit continuity:
-- `audit_event.entity_type = 'RISK_TREATMENT_ACTION'` rows point at these
-- ids and must keep resolving — Constitution Principle XV).

-- ============================================================================
-- STEP 0B — Recover the REAL completer of every already-COMPLETED row from
-- the audit trail, before writing or reconciling anything.
--
-- CORRECTED BY THE COORDINATOR, 2026-09-11, after this migration was first
-- run against real multi-shape data and found to need a value here at
-- all (see the corrected paragraph in STEP 1's INSERT, kept visible below
-- rather than silently rewritten). The original text proposed attributing
-- an unrecorded completion to the row's own `responsible_user_id` when no
-- better value was available. That is a FABRICATION and is rejected
-- outright: `responsible_user_id` is who the work was ASSIGNED to, not who
-- MARKED IT DONE — an audit trail in a compliance product must never
-- record that a person did something they did not do (the same principle
-- already applied to session expiry, D-13).
--
-- The real fact is recoverable, not merely guessable: every completion
-- through the pre-convergence risk route fired
-- `risk.treatment_action_status_changed`, keyed to the LINK ROW's own id,
-- with `new_values.status = 'COMPLETED'` and a real `actor_user_id` column
-- (populated by the request context of an authenticated PATCH — distinct
-- from the login-specific gap D-13 fixes). Taking the LATEST such event
-- per row recovers who actually completed it.
--
-- A TEMP TABLE (dropped automatically at the end of this transaction,
-- `ON COMMIT DROP`) because this fact is needed by both STEP 1 (backfill
-- INSERT) and STEP 1B (reconcile UPDATE), which are separate statements —
-- a CTE cannot span them.
CREATE TEMP TABLE recovered_completer ON COMMIT DROP AS
SELECT DISTINCT ON (rta.id)
  rta.id AS rta_id,
  ae.actor_user_id AS completed_by_user_id
FROM risk_treatment_actions rta
JOIN audit_event ae
  ON ae.entity_type = 'RISK_TREATMENT_ACTION'
 AND ae.entity_id = rta.id
 AND ae.action = 'risk.treatment_action_status_changed'
 AND ae.new_values ->> 'status' = 'COMPLETED'
WHERE rta.status = 'COMPLETED'
ORDER BY rta.id, ae.occurred_at DESC;

-- Fourth verification check, run BEFORE any write, not after: a
-- `COMPLETED` link row with NO recoverable completer is a PRE-EXISTING
-- DATA DEFECT (an actor_user_id the audit trail itself never captured, or
-- a completion this migration cannot trace) — the migration's job is to
-- SURFACE it by name, never to paper over it with an invented value.
-- Measured before accepting this design: the developer database has 75
-- link rows, every one `OPEN`, zero completion events to recover — this
-- check is expected to find NOTHING there and never fire in practice
-- today; it exists for the row that DOES complete, now and in the future.
DO $$
DECLARE
  unrecoverable_ids text;
BEGIN
  SELECT string_agg(rta.id::text, ', ')
  INTO unrecoverable_ids
  FROM risk_treatment_actions rta
  LEFT JOIN recovered_completer rc ON rc.rta_id = rta.id
  WHERE rta.status = 'COMPLETED' AND rc.completed_by_user_id IS NULL;

  IF unrecoverable_ids IS NOT NULL THEN
    RAISE EXCEPTION
      'Action convergence: the following risk_treatment_actions row(s) are COMPLETED with no recoverable completer in the audit trail (risk.treatment_action_status_changed, actor_user_id) -- refusing to fabricate one: %',
      unrecoverable_ids;
  END IF;
END $$;

-- ============================================================================
-- STEP 1 — Backfill an `Action` for every risk_treatment_actions row that
-- does not already have one (`action_id IS NULL`).
-- ============================================================================

WITH pending AS (
  SELECT
    rta.id                    AS rta_id,
    rta.risk_id               AS risk_id,
    rta.title                 AS title,
    rta.description           AS description,
    rta.responsible_user_id   AS responsible_user_id,
    rta.due_on                AS due_on,
    rta.status                AS status,
    rta.completed_at          AS completed_at,
    rc.completed_by_user_id   AS completed_by_user_id,
    rta.created_at            AS created_at,
    rta.updated_at            AS updated_at,
    r.org_unit_id             AS org_unit_id,
    -- The risk's CURRENT organizational unit (data-model.md §2/§3 invariant)
    -- — the same rule `assertActionOriginInScope` already applies at
    -- runtime for every action derived from a risk. Not a historical
    -- reconstruction: there is no column recording what the risk's unit was
    -- at the moment this treatment action was created.
    EXTRACT(YEAR FROM rta.created_at)::int AS backfill_year
    -- The code's year is the year of the ROW'S OWN created_at, never the
    -- current year — so a backfilled code does not misdate the record
    -- (data-model.md §6/D-6).
  FROM risk_treatment_actions rta
  JOIN risks r ON r.id = rta.risk_id
  LEFT JOIN recovered_completer rc ON rc.rta_id = rta.id
  WHERE rta.action_id IS NULL
),
numbered AS (
  SELECT
    pending.*,
    ROW_NUMBER() OVER (PARTITION BY backfill_year ORDER BY created_at, rta_id) AS rn
  FROM pending
),
year_totals AS (
  SELECT backfill_year, COUNT(*) AS n
  FROM numbered
  GROUP BY backfill_year
),
-- Ensure a `grc_code_sequences` row exists for every year this backfill
-- touches, before reserving a range on it.
ensured_years AS (
  INSERT INTO grc_code_sequences (prefix, year, last_value)
  SELECT 'ACT', year_totals.backfill_year, 0
  FROM year_totals
  ON CONFLICT (prefix, year) DO NOTHING
  RETURNING 1
),
-- Reserve the whole range for each year in ONE atomic UPDATE, inside this
-- same migration transaction — no concurrent `Action` creation in
-- production can interleave here because this transaction already holds
-- the row lock on every `(ACT, year)` sequence row it touches.
reserved AS (
  UPDATE grc_code_sequences gcs
  SET last_value = gcs.last_value + year_totals.n
  FROM year_totals
  WHERE gcs.prefix = 'ACT' AND gcs.year = year_totals.backfill_year
  RETURNING gcs.year AS backfill_year, gcs.last_value - year_totals.n AS starting_value
),
-- Materialized explicitly (not left to the planner's "referenced more than
-- once" default) because `new_action_id` is generated by a VOLATILE
-- function (`gen_random_uuid()`) and MUST be the identical value in both
-- places this CTE is read below (the `actions` insert and the
-- `risk_treatment_actions` update) — this is what lets the final UPDATE
-- join by `rta_id` directly instead of reconstructing identity from
-- `RETURNING`, which the correlation `(risk_id, created_at)` alone cannot
-- guarantee unique (two treatment actions for the same risk created at the
-- same instant, however unlikely with `uuid(7)` ids, would otherwise
-- collide).
to_insert AS MATERIALIZED (
  SELECT
    numbered.*,
    reserved.starting_value + numbered.rn AS sequence_number,
    gen_random_uuid() AS new_action_id
  FROM numbered
  JOIN reserved ON reserved.backfill_year = numbered.backfill_year
),
inserted_actions AS (
  INSERT INTO actions (
    id, code, org_unit_id, origin_type, origin_id,
    title, description, responsible_user_id, due_on, status,
    completed_at, completed_by_user_id, reopened_at, reopened_by_user_id, reopen_reason,
    created_at, updated_at
  )
  SELECT
    new_action_id,
    'ACT-' || backfill_year || '-' || LPAD(sequence_number::text, 4, '0'),
    org_unit_id,
    'RISK_TREATMENT',
    risk_id,
    title,
    description,
    responsible_user_id,
    due_on,
    status::text::"ActionStatus",
    completed_at,
    -- completed_by_user_id: RECOVERED FROM THE AUDIT TRAIL (STEP 0B),
    -- never fabricated. `actions_completed_pair_check`
    -- (20260907100000_pairing_invariant_check_constraints) requires this
    -- to be non-null whenever completed_at is non-null; STEP 0B's own
    -- guard already aborted the transaction above if any COMPLETED row
    -- had no recoverable value, so `completed_by_user_id` here is never
    -- null for a row that reaches this INSERT.
    --
    -- CORRECTED BY THE COORDINATOR, 2026-09-11 (kept visible, not
    -- rewritten away — this project's own standing rule): the version of
    -- this line that first ran against real data used
    -- `responsible_user_id` as a fallback attribution, flagged at the time
    -- as "not a verified historical fact". That was rejected outright:
    -- `responsible_user_id` is who the work was ASSIGNED to, not who
    -- MARKED IT DONE, and a compliance audit trail must never record that
    -- a person did something they did not do. See STEP 0B above for the
    -- real recovery mechanism.
    completed_by_user_id,
    NULL, -- reopened_at: no legacy row was ever reopened through this table's
          -- own mechanism — history starts clean.
    NULL, -- reopened_by_user_id
    NULL, -- reopen_reason
    created_at, -- preserves the ORIGINAL creation instant, never "now"
    updated_at
  FROM to_insert
  RETURNING 1
)
UPDATE risk_treatment_actions rta
SET action_id = to_insert.new_action_id
FROM to_insert
WHERE rta.id = to_insert.rta_id;

-- ============================================================================
-- STEP 1B — Reconcile, before verifying. CONFIRMED DEFECT (coordinator,
-- measured against pharos_grc_test): for a link row that was ALREADY
-- linked before this migration (the pre-existing R-003 double-write, not
-- one this migration just backfilled), the linked Action can disagree with
-- its link row — measured as a 7-millisecond difference on `completed_at`
-- alone, on an otherwise byte-identical row. Root cause: the mirror path
-- (`UpdateTreatmentActionUseCase` calling `MirrorActionStatusFromOriginUseCase`)
-- computes ITS OWN `new Date()` for the same completion instant that
-- `UpdateTreatmentActionUseCase` itself already computed independently —
-- two clock reads for one event, in the same transaction. The double-write
-- was therefore never lossless; F-36 named the coexistence window but not
-- this specific drift. This is NOT worked around with a tolerance or a
-- relaxed comparison in STEP 2 below — that would hide exactly the drift
-- class the verification exists to catch. Instead: RECONCILE first.
--
-- `RiskTreatmentAction` is the PRE-CONVERGENCE AUTHORITY — every current
-- route, response and screen reads THIS table (data-model.md §7, FR-018),
-- so its stored values are what users have actually seen and what the
-- risk audit trail actually recorded. Its six values are pushed onto the
-- linked Action, unconditionally, for EVERY link row (including the ones
-- STEP 1 just backfilled a moment ago, for which this is a harmless no-op
-- — they were built to match already).
UPDATE actions a
SET
  title = rta.title,
  description = rta.description,
  responsible_user_id = rta.responsible_user_id,
  due_on = rta.due_on,
  status = rta.status::text::"ActionStatus",
  completed_at = rta.completed_at,
  -- RECOVERED FROM THE AUDIT TRAIL (STEP 0B), never fabricated — same
  -- correction and same reasoning as STEP 1's INSERT above. `NULL` here
  -- for a non-COMPLETED row is correct (the pair-check requires it).
  completed_by_user_id = recovered_completer.completed_by_user_id
FROM risk_treatment_actions rta
LEFT JOIN recovered_completer ON recovered_completer.rta_id = rta.id
WHERE a.id = rta.action_id;

-- ============================================================================
-- STEP 2 — Verify, before any DROP. Aborts the whole transaction (RAISE
-- EXCEPTION) if any invariant fails — the DROP in step 3 below then never
-- executes, because the transaction never reaches it. Kept EXACTLY as
-- strict as before the reconciliation above — the check is what PROVES the
-- reconciliation worked, not a formality now made redundant by it.
-- ============================================================================

DO $$
DECLARE
  orphan_link_count integer;
  duplicate_count integer;
  mismatch_count integer;
  orphan_action_count integer;
BEGIN
  -- (a) Zero link rows still without an action_id.
  SELECT COUNT(*) INTO orphan_link_count
  FROM risk_treatment_actions
  WHERE action_id IS NULL;

  IF orphan_link_count <> 0 THEN
    RAISE EXCEPTION
      'Action convergence backfill left % risk_treatment_actions row(s) with a NULL action_id',
      orphan_link_count;
  END IF;

  -- (b) action_id is unique (no Action reused by two link rows).
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT action_id
    FROM risk_treatment_actions
    GROUP BY action_id
    HAVING COUNT(*) > 1
  ) AS dupes;

  IF duplicate_count <> 0 THEN
    RAISE EXCEPTION
      'Action convergence backfill produced % duplicated action_id value(s)',
      duplicate_count;
  END IF;

  -- (c) Field-by-field equality between each link row and its Action, for
  -- the six columns that migrate, AND that the Action's origin genuinely
  -- IS this link row's risk. Coordinator review, 2026-09-11: the origin
  -- conditions previously sat in the WHERE clause as a FILTER, excluding a
  -- mismatched-origin row from the count instead of flagging it — a guard
  -- that passes because it never looks at the bad row, the exact failure
  -- mode this project keeps paying for (F-42's own name for it). Fixed by
  -- moving both origin conditions INTO the disjunction being counted, so a
  -- mismatch is a finding, never a silent exclusion.
  SELECT COUNT(*) INTO mismatch_count
  FROM risk_treatment_actions rta
  JOIN actions a ON a.id = rta.action_id
  WHERE a.origin_type IS DISTINCT FROM 'RISK_TREATMENT'::"ActionOriginType" OR
        a.origin_id IS DISTINCT FROM rta.risk_id OR
        a.title IS DISTINCT FROM rta.title OR
        a.description IS DISTINCT FROM rta.description OR
        a.responsible_user_id IS DISTINCT FROM rta.responsible_user_id OR
        a.due_on IS DISTINCT FROM rta.due_on OR
        a.status::text IS DISTINCT FROM rta.status::text OR
        a.completed_at IS DISTINCT FROM rta.completed_at;

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION
      'Action convergence backfill produced % row(s) whose Action disagrees with its link row (title/description/responsible/dueOn/status/completedAt/origin_type/origin_id)',
      mismatch_count;
  END IF;

  -- (d) The orphan-Action population (D-2): an Action with
  -- origin_type = RISK_TREATMENT, whose origin_id is a REAL risk, but with
  -- NO link row in risk_treatment_actions. This is EXPECTED and BY DESIGN
  -- (research.md D-2) — an Action created directly through `POST /actions`
  -- with originType RISK_TREATMENT never gets a link row unless a caller
  -- later sets `treatmentDecisionId` through the risk route. Measured at 3
  -- rows in the development database at spec time. Asserted here as an
  -- explicit, named invariant check — surfaced via RAISE NOTICE, never a
  -- silent fact left to be discovered later — rather than a failure,
  -- because failing the migration over BY-DESIGN orphans would be wrong.
  SELECT COUNT(*) INTO orphan_action_count
  FROM actions a
  JOIN risks r ON r.id = a.origin_id
  WHERE a.origin_type = 'RISK_TREATMENT'
    AND NOT EXISTS (
      SELECT 1 FROM risk_treatment_actions rta WHERE rta.action_id = a.id
    );

  RAISE NOTICE
    'Action convergence: % Action row(s) with origin_type=RISK_TREATMENT and a real origin risk have NO risk_treatment_actions link row. This is EXPECTED by design (research.md D-2) -- these become visible on their risk''s treatment-action listing after this migration, where they were previously invisible.',
    orphan_action_count;
END $$;

-- ============================================================================
-- STEP 3 — Only now: harden action_id, drop the six superseded columns and
-- the three indexes that referenced them, add the replacement index.
-- ============================================================================

ALTER TABLE risk_treatment_actions
  ALTER COLUMN action_id SET NOT NULL;

ALTER TABLE risk_treatment_actions
  ADD CONSTRAINT risk_treatment_actions_action_id_key UNIQUE (action_id);

DROP INDEX IF EXISTS risk_treatment_actions_risk_id_status_idx;
DROP INDEX IF EXISTS risk_treatment_actions_responsible_user_id_due_on_idx;
DROP INDEX IF EXISTS risk_treatment_actions_due_on_status_idx;

ALTER TABLE risk_treatment_actions
  DROP COLUMN title,
  DROP COLUMN description,
  DROP COLUMN responsible_user_id,
  DROP COLUMN due_on,
  DROP COLUMN status,
  DROP COLUMN completed_at;

CREATE INDEX risk_treatment_actions_risk_id_idx ON risk_treatment_actions (risk_id);

-- Coordinator review, 2026-09-11: `TreatmentActionStatus` backed only the
-- `status` column just dropped above and nothing else in the schema
-- (confirmed: no other column references it). Dropping a Postgres enum
-- TYPE outright is safe and unrestricted (unlike removing one VALUE from
-- an enum still in use) — done here, in the same migration, rather than
-- left as a separate future cleanup, so the convergence guard
-- (`test/unit/action-model-convergence-guard.spec.ts`) never has to assert
-- against an enum that backs nothing, which would be an assertion that
-- cannot fail — the exact shape this project keeps paying for.
DROP TYPE "TreatmentActionStatus";

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '3938f31c-d778-5255-95ba-595381299661',
    '29912250cf527083c181306481663d2b5e04a151fb9d3bbb37a222ea0dcadeee',
    CURRENT_TIMESTAMP,
    '20260911000000_action_convergence_risk_treatment_actions',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260911010000_control_assessments_org_unit_id
-- 007-implementation-remediation, D-11/T009 — additive: denormalize
-- `control_assessments.org_unit_id` from `controls.org_unit_id`.
--
-- This exists because `ControlAssessmentRepository.listAssessmentIdsInScope`
-- (confirmed by direct reading) decides row visibility through a JOIN up to
-- `controls.org_unit_id` — exactly what this project's own ratified rule in
-- AGENTS.md forbids: "carregar o escopo organizacional em toda tabela
-- escopada, mesmo quando derivável por relação; autorização nunca deve
-- depender de um JOIN". The repository half that reads this column belongs
-- to another agent; this migration is only the schema half: the column,
-- the backfill, and the guarantee that keeps it correct going forward.
--
-- Nullable, matching `controls.org_unit_id`'s own nullability — a control
-- may have no organizational unit (a global control), and an assessment of
-- it is then equally unscoped.
--
-- THE GUARANTEE (principle §19.7 of this codebase — derived state has
-- exactly ONE calculator): no application code path ever writes this
-- column. Two triggers are the only calculator, together covering both
-- ways the value could otherwise go stale:
--
--   1. `control_assessments_set_org_unit_id` (BEFORE INSERT on
--      control_assessments): unconditionally overwrites NEW.org_unit_id
--      from the referenced control's CURRENT org_unit_id, ignoring
--      whatever value a caller supplied (there is no legitimate one — a
--      caller that tried to set this directly would just be wrong, so the
--      trigger does not merely default a NULL, it overrides always).
--
--   2. `control_assessments_cascade_org_unit_from_control` (AFTER UPDATE
--      on controls, only when org_unit_id actually changed): propagates
--      the new value onto every existing assessment of that control. This
--      is the half that matters for correctness over time — a control can
--      move to a different organizational unit after it already has
--      assessments (`UpdateControlUseCase` allows changing `orgUnitId`),
--      and without this trigger the backfilled/inserted value on old
--      assessment rows would silently disagree with the control's current
--      unit the next time it moves. Both triggers together mean the write
--      path never needs to know this column exists at all.

ALTER TABLE control_assessments
  ADD COLUMN org_unit_id UUID REFERENCES organizational_units (id);

-- Backfill every existing row from its control's CURRENT org unit — the
-- only value there is to backfill from; there is no historical record of
-- what a control's unit was at the moment each assessment was created.
UPDATE control_assessments ca
SET org_unit_id = c.org_unit_id
FROM controls c
WHERE c.id = ca.control_id;

CREATE INDEX control_assessments_org_unit_id_idx ON control_assessments (org_unit_id);

-- Trigger 1 — single calculator at INSERT time.
CREATE OR REPLACE FUNCTION control_assessments_set_org_unit_id() RETURNS trigger AS $$
BEGIN
  SELECT c.org_unit_id INTO NEW.org_unit_id
  FROM controls c
  WHERE c.id = NEW.control_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER control_assessments_set_org_unit_id
  BEFORE INSERT ON control_assessments
  FOR EACH ROW EXECUTE FUNCTION control_assessments_set_org_unit_id();

-- Trigger 2 — single calculator when a control moves, cascading to every
-- assessment it already has. `WHEN` guards the common case (an update that
-- does not touch org_unit_id, e.g. a status transition) so the cascading
-- UPDATE only ever runs on the row-count that can possibly need it.
CREATE OR REPLACE FUNCTION control_assessments_cascade_org_unit_from_control() RETURNS trigger AS $$
BEGIN
  UPDATE control_assessments
  SET org_unit_id = NEW.org_unit_id
  WHERE control_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER control_assessments_cascade_org_unit_from_control
  AFTER UPDATE ON controls
  FOR EACH ROW
  WHEN (OLD.org_unit_id IS DISTINCT FROM NEW.org_unit_id)
  EXECUTE FUNCTION control_assessments_cascade_org_unit_from_control();

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    'fc2a656f-285b-5c79-a5cb-038d70e86b31',
    'd29e49cc098ee8aaf1d65ff9ff62664441c7550f39ac3cb6a18256f240fa7c62',
    CURRENT_TIMESTAMP,
    '20260911010000_control_assessments_org_unit_id',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260911020000_incidents_problems_foundation_baseline
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

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '810d5e06-0a00-545d-a0ba-cb0a66856b25',
    '55fac39a2eb9c5eef061157e858d7eb8902942bc0c95eb27f7ee327ce16d1ed5',
    CURRENT_TIMESTAMP,
    '20260911020000_incidents_problems_foundation_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260911030000_action_origin_type_add_incidents_problems
-- 008-incidents-problems — additive growth of `ActionOriginType` with
-- `INCIDENT`/`PROBLEM` (ADR-008: "closed platform enums grow by reviewed
-- migration"), paired atomically with `IncidentActionOriginAccessor`/
-- `ProblemActionOriginAccessor` landing in this same change (spec.md
-- FR-016, research.md D-2). Deliberately its own migration, separate
-- from `20260911020000_incidents_problems_foundation_baseline` — the
-- foundation migration shipped without this enum growth (a decision of
-- the coordinator, made at the time, to defer the origin-type until its
-- four-method accessor existed for real, `test/unit/
-- action-model-convergence-guard.spec.ts`'s own enforced 1:1 rule) — so
-- keeping the two changes in separate, dated migrations keeps them
-- legible as what they actually were: two decisions, not one.
--
-- `IF NOT EXISTS` on both statements (PostgreSQL 12+): an EARLIER
-- revision of the foundation migration briefly did add these two values,
-- before the deferral decision, and was applied — by the connection-
-- variable mistake `docs/local-environment.md` D-18 records — to BOTH
-- `pharos_grc` and `pharos_grc_test` before being reverted from the
-- committed migration file. PostgreSQL has no `ALTER TYPE ... DROP
-- VALUE`, so both of those databases still physically carry `INCIDENT`/
-- `PROBLEM` on `ActionOriginType` (`docs/local-environment.md` D-19).
-- Without `IF NOT EXISTS`, this migration would fail with
-- `unsafe use of new value "INCIDENT" of enum type` / a duplicate-value
-- error the moment it reached either of those two specific databases —
-- verified directly (see this feature's own report) rather than assumed:
-- applying this migration to `pharos_grc_test` (already carrying both
-- values from the accident) succeeds and reports "No pending migrations"
-- afterward on immediate re-run, exactly as it does against a genuinely
-- fresh database where the values do not exist yet.
ALTER TYPE "ActionOriginType" ADD VALUE IF NOT EXISTS 'INCIDENT';
ALTER TYPE "ActionOriginType" ADD VALUE IF NOT EXISTS 'PROBLEM';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '7d484222-b48e-5ee7-9c4d-beb2acb09b88',
    'ac59b4c4b4e2fd83111a268be331cfa20a4fec9f7cec029f5b93beb8f633e486',
    CURRENT_TIMESTAMP,
    '20260911030000_action_origin_type_add_incidents_problems',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260911040000_indicators_reports_foundation_baseline
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
-- `pharos_config`, and renaming six foreign-key constraints on Compliance
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

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '840b2a6a-f8c4-5d31-acbe-e07563f8df7c',
    '7e009a8467908b2a887fc316ab6936e54ed1687e3e0544a14f7f90e3a676ff96',
    CURRENT_TIMESTAMP,
    '20260911040000_indicators_reports_foundation_baseline',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

-- Migração: 20260912000000_action_origin_type_add_indicator
-- 009-indicators-reports, Fase 6 (T043, US4) — additive growth of
-- `ActionOriginType` with `INDICATOR` (ADR-008: "closed platform enums
-- grow by reviewed migration"), paired atomically with
-- `IndicatorActionOriginAccessor` landing in this same change (spec.md
-- FR-020, research.md D-5). Deliberately its own migration, separate from
-- `20260911040000_indicators_reports_foundation_baseline` — that
-- migration's own header already documents the deferral: "`ActionOriginType
-- += INDICATOR` is DELIBERATELY NOT part of this migration ... deferred to
-- Fase 6 (US4), paired atomically, in its own migration, with
-- `IndicatorActionOriginAccessor` and the four methods `test/unit/
-- action-model-convergence-guard.spec.ts` requires." Same discipline
-- `008-incidents-problems` already applied to the same enum
-- (`20260911030000_action_origin_type_add_incidents_problems`).
--
-- `IF NOT EXISTS` (PostgreSQL 12+), mirroring that same sibling migration's
-- own use of it — this feature has not hit the D-18/D-19 connection-
-- variable accident that motivated it there, but the guard is free and
-- keeps this migration safely re-runnable against a database that, for any
-- reason, already carries the value.
ALTER TYPE "ActionOriginType" ADD VALUE IF NOT EXISTS 'INDICATOR';

INSERT INTO public."_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '45441930-0e10-59ac-9c3e-0b37eb7b6ffe',
    'efb1704af15dc0d0d4953d1d0d622a4529eed169b0bfe385a0c67a753e2d5ef1',
    CURRENT_TIMESTAMP,
    '20260912000000_action_origin_type_add_indicator',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
);

RESET ROLE;
COMMIT;
