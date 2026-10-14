-- Assurance fix (Fix 6, confirmed gap) — `audit_event`'s append-only
-- trigger (`audit_event_append_only`,
-- `20260905120200_audit_event_append_only`) is declared `BEFORE UPDATE OR
-- DELETE`. Live testing against a running instance confirmed the table
-- OWNER (`vertice_owner` — the application role `vertice_app` cannot even
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
-- schema-level protection, not a privilege boundary, and `vertice_owner`
-- holds full DDL rights over its own tables by definition. This is
-- therefore NOT tamper-evidence and must never be described as such: it
-- raises the bar against a mistake, not against a determined and
-- privileged actor who chooses to remove the guard first. Real
-- tamper-evidence for `audit_event` would require a separate control
-- (e.g. an external WAL-shipped copy, or a superuser-owned trigger a
-- `vertice_owner` session cannot alter) — out of scope for this fix.
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
-- through (`create_audit_event_partition()`, `vertice_owner`-only, no
-- scheduler invokes it automatically — ADR-015).
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
    'Idempotently creates the monthly audit_event partition containing target_month, adds the SAME BEFORE TRUNCATE guard (Fix 6) the parent and every other partition carry, and grants the role named in vertice_config (key = ''app_role'') SELECT/INSERT while revoking UPDATE/DELETE on it, so FR-034 (append-only) holds for partitions created after today. Call ahead of need (an empty audit_event_default is the sign nothing is overdue). Must be run as vertice_owner. No scheduler invokes this automatically (ADR-015) — it is an operational or future-migration responsibility.';
