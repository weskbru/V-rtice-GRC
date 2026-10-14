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

-- `vertice_config` — the single source of truth for the application role's
-- name, read by `create_audit_event_partition()` below and by the
-- privilege statements in the next migration (T028).
--
-- The original design for this used a database-level custom GUC
-- (`ALTER DATABASE ... SET vertice.app_role = ...`), read back everywhere
-- via `current_setting(...)`. That does not work here: PostgreSQL 15+
-- gates `ALTER DATABASE`/`ALTER ROLE ... SET` of a parameter behind a
-- `pg_parameter_acl` grant that only a superuser can hand out (a plain
-- session-level `SET` of a custom placeholder parameter needs no such
-- grant, but persisting it at the database level does), and neither role
-- available to this project (`vertice_owner`, `vertice_app`) is a
-- superuser — confirmed empirically against this PostgreSQL 18 instance
-- (`ALTER DATABASE vertice_grc SET vertice.app_role = 'vertice_app'` as
-- `vertice_owner` fails with `permissão negada ao definir parâmetro`,
-- while plain `SET vertice.app_role = 'vertice_app'` in the same session
-- succeeds). A one-row config table needs no privilege beyond owning the
-- table, which `vertice_owner` already has, and is read identically from
-- any session, present or future — so it replaces the GUC design.
--
-- The literal 'vertice_app' appears exactly once below (the INSERT) and
-- once more in the REVOKE immediately after (REVOKE needs a role
-- identifier, which cannot be parameterized without EXECUTE format(...);
-- since this REVOKE is about protecting the row that names the app role,
-- from the app role, spelling it out here is the unavoidable bootstrap —
-- every other GRANT/REVOKE in this migration and in T028 reads the name
-- back from this table instead of repeating the literal).
CREATE TABLE "vertice_config" (
    "key"   TEXT PRIMARY KEY,
    "value" TEXT NOT NULL
);

COMMENT ON TABLE "vertice_config" IS
    'Tiny platform settings table. Currently holds one row: the application database role''s name (key = ''app_role''), read by create_audit_event_partition() and by the audit_event append-only migration, so that role name is declared once and every dynamic GRANT/REVOKE reads it back rather than repeating the literal. Not a general-purpose settings table for application features — those belong in the Configuration core capability (CLAUDE.md §4), not here.';

INSERT INTO "vertice_config" ("key", "value") VALUES ('app_role', 'vertice_app');

-- Lock the table down: only vertice_owner (its creator) may read or write
-- it. Without this, the schema-wide default privilege that grants
-- vertice_app SELECT/INSERT/UPDATE/DELETE on every new table vertice_owner
-- creates (docs/local-environment.md) would apply here too, letting the
-- application role read — and worse, rewrite — the very row that names it.
REVOKE ALL ON "vertice_config" FROM PUBLIC;
REVOKE ALL ON "vertice_config" FROM "vertice_app";

-- Callable partition-creation function (no scheduler — ADR-015). Given any
-- date within a target month, creates that month's partition if it does
-- not already exist, then grants it the same append-only policy as the
-- rest of audit_event using the role named in `vertice_config` above:
-- SELECT/INSERT granted, UPDATE/DELETE revoked. This is the mechanism that
-- keeps FR-034 holding for partitions created after today, which a
-- human-run migration cannot anticipate the names of.
--
-- Idempotent: calling it again for a month that already has a partition
-- is a no-op. Must be run as a role with ownership privileges on
-- audit_event (vertice_owner) — it is not SECURITY DEFINER, and a run as
-- vertice_app would fail at the CREATE TABLE step for lack of privilege
-- (and could not even see `vertice_config`, per the REVOKE above).
CREATE OR REPLACE FUNCTION create_audit_event_partition(target_month date)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
    partition_start date := (date_trunc('month', target_month))::date;
    partition_end   date := (date_trunc('month', target_month) + interval '1 month')::date;
    partition_name  text := format('audit_event_%s', to_char(partition_start, 'YYYY_MM'));
    app_role        text := (SELECT value FROM vertice_config WHERE key = 'app_role');
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
    'Idempotently creates the monthly audit_event partition containing target_month, and grants the role named in vertice_config (key = ''app_role'') SELECT/INSERT while revoking UPDATE/DELETE on it, so FR-034 (append-only) holds for partitions created after today. Call ahead of need (an empty audit_event_default is the sign nothing is overdue). Must be run as vertice_owner. No scheduler invokes this automatically (ADR-015) — it is an operational or future-migration responsibility.';

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
