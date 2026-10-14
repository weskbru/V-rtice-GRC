-- T028 — Enforce append-only on `audit_event` at the database (FR-034,
-- ADR-005): the application role gets INSERT/SELECT only, and a
-- BEFORE UPDATE OR DELETE trigger raises even for a privileged mistake.
--
-- The application role's name is read from `vertice_config` (created by the
-- previous migration, T027 — see that file for why a one-row config table
-- is used here instead of a database-level custom setting: PostgreSQL 15+
-- requires a superuser-granted parameter ACL to persist a custom GUC via
-- `ALTER DATABASE ... SET`, which neither `vertice_owner` nor `vertice_app`
-- has on this instance). Every GRANT/REVOKE below reads
-- `(SELECT value FROM vertice_config WHERE key = 'app_role')` instead of
-- repeating the literal 'vertice_app'.

-- Trigger function: unconditionally rejects UPDATE and DELETE. Kept
-- separate from privilege revocation on purpose (ADR-005): GRANT/REVOKE
-- protects against the *application* role; a trigger protects against
-- *any* role, including vertice_owner running an ad hoc UPDATE by mistake,
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
-- statements using the role name from `vertice_config`. There is no third
-- path for a partition to come into existence (partition creation is a DDL
-- operation only vertice_owner can perform), so covering the parent, every
-- existing partition and the creation function is the complete set.
DO $$
DECLARE
    app_role text := (SELECT value FROM vertice_config WHERE key = 'app_role');
    rec record;
BEGIN
    IF app_role IS NULL THEN
        RAISE EXCEPTION 'vertice_config has no app_role row — cannot enforce audit_event append-only privileges';
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
