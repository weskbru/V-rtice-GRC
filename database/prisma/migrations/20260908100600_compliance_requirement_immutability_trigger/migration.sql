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
