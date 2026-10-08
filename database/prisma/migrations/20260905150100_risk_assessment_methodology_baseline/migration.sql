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
