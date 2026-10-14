-- T206a — THROWAWAY PROBE (SC-011 verification). `probe_records` is an
-- ordinary, fully mutable, non-append-only table (unlike
-- `risk_treatment_decisions`/`approvals` — see F-20): it carries no
-- `BEFORE UPDATE OR DELETE` trigger, so it can be genuinely dropped when the
-- probe module is removed, unlike the enum values added in the previous
-- migration. Default privileges already grant `vertice_app`
-- SELECT/INSERT/UPDATE/DELETE on any table `vertice_owner` creates (see
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
