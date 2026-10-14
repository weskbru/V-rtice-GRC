-- T206a — THROWAWAY PROBE (SC-011 re-verification), re-run. Reintroduces
-- `probe_records`, identical in shape to the first run's own
-- `20260906090100_probe_record_baseline` (dropped by
-- `20260906091500_probe_record_teardown`). It is an ordinary, fully mutable,
-- non-append-only table (unlike `risk_treatment_decisions`/`approvals` —
-- F-20): it carries no `BEFORE UPDATE OR DELETE` trigger, so it can be
-- genuinely dropped again when the probe module is removed. Default
-- privileges already grant `vertice_app` SELECT/INSERT/UPDATE/DELETE on any
-- table `vertice_owner` creates (docs/local-environment.md's Database
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
