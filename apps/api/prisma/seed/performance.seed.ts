/**
 * T200 — the 50,000-risk performance fixture (SC-004, plan.md's
 * performance budgets, T201/T197's dashboard aggregates).
 *
 * ## Explicitly invoked, never part of the normal seed
 *
 * This file is NOT imported by `prisma/seed/index.ts` and never runs as
 * part of `prisma db seed` / `pnpm --filter @pharos/api run db:seed`. It is
 * its own script, run directly:
 *
 * ```bash
 * pnpm --filter @pharos/api run db:seed:performance            # seed 50,000 risks
 * pnpm --filter @pharos/api run db:seed:performance -- --count=5000  # a smaller run
 * pnpm --filter @pharos/api run db:seed:performance -- --reset  # remove the fixture
 * ```
 *
 * Bootstraps the same minimal Nest application context `prisma/seed/index.ts`
 * uses (`AppConfigModule` + `PrismaModule`) so this script connects with the
 * SAME restricted `pharos_app` role (ADR-005) the running application uses
 * — never a bare `new PrismaClient()` reading `process.env` directly.
 *
 * ## Clearly labelled and reversible
 *
 * Every row this script creates is tagged so it can be found and removed
 * independently of any other data in the database:
 *
 * - `risks.code` always starts with `PERF-` (never `RSK-…`, the real
 *   `formatRiskCode` prefix — `domain/risk-code.ts` — so a performance-
 *   fixture risk can never be mistaken for a genuine one, and the two id
 *   spaces never collide).
 * - `organizational_units.code` starts with `PERF-OU-`.
 * - `users.email` starts with `perf-` (`@example.test`, the same
 *   non-routable test domain `test/integration/support/fixtures.ts` uses).
 * - `risk_categories`/`risk_types`/`risk_origins.code` start with
 *   `PERF-CAT-`/`PERF-TYPE-`/`PERF-ORIGIN-`.
 *
 * `--reset` deletes every row carrying one of these markers, in FK-safe
 * order (`cleanupPerformanceFixture` below). Running the fixture, then
 * `--reset`, leaves the database exactly as it was found (verified in the
 * implementation report by comparing `information_schema`-reported row
 * counts across every table this script touches, before and after) — see
 * "Why treatment decisions and approvals are NOT part of this fixture"
 * below for the one architectural reason this is achievable at all.
 *
 * ## Idempotent
 *
 * Before creating anything, this script counts existing `PERF-`-coded
 * risks. If that count already meets or exceeds the requested `--count`,
 * it does nothing and exits — running it twice with the same `--count`
 * produces IDENTICAL row counts on every table it touches (verified by
 * hand: run once, record counts; run again; counts unchanged). It does not
 * attempt to "top up" a partial run to a different count — a mismatched
 * existing count is reported and the script refuses to guess whether that
 * is a smaller prior run or a partially-failed one; `--reset` first, then
 * reseed, is the supported path for changing `--count`.
 *
 * ## Realistic, not uniform (T200's own instruction)
 *
 * Risks are distributed across 21 organizational units with a Zipf-like
 * skew (a few units carry far more risk than most — the shape a real
 * portfolio has, not a flat 50,000/21 split), across 5 categories/2
 * types/4 origins with fixed uneven weights, and across all 8
 * `RiskStatus` values with weights reflecting a real register (most risks
 * sit in `ASSESSED`/`UNDER_TREATMENT`, few in `DRAFT`/`ARCHIVED`).
 * Probability/impact factors are independently randomized per risk
 * (uniform over the 1-5 scale), with residual deliberately biased lower
 * than inherent (treatment is assumed to reduce exposure, not leave it
 * unchanged) — this alone produces a non-uniform level distribution
 * without hand-tuning level weights directly.
 *
 * Every risk from `ASSESSED` onward gets exactly one real `RiskAssessment`
 * row backing its stored `inherentScore`/`residualScore` (never a score
 * with no assessment behind it); a 40% sample of `UNDER_TREATMENT`-or-later
 * risks additionally get 1-2 `RiskTreatmentAction` rows, weighted so a
 * meaningful share (computed, not hand-set — see `ACTION_STATUS_WEIGHTS`)
 * are overdue.
 *
 * ## Why treatment decisions and approvals are NOT part of this fixture
 * (found empirically, not assumed)
 *
 * `risk_treatment_decisions` and `approvals` both carry a database-level
 * `BEFORE UPDATE OR DELETE` trigger (`risk_treatment_decisions_prevent_
 * overwrite` / `approvals_prevent_overwrite`,
 * `20260905160100_risk_treatment_and_relationships_baseline` /
 * `20260905170100_risk_lifecycle_and_approvals_baseline`) that
 * unconditionally rejects `DELETE` — for EVERY role, including
 * `pharos_owner`, since a trigger fires regardless of who issues the
 * statement (unlike a `GRANT`/`REVOKE`, which only affects one role). This
 * is deliberate, correct architecture (ADR-007's whole point: a recorded
 * treatment decision or a decided approval is a historical fact of an
 * audited GRC platform, not a row a later process gets to erase) — but it
 * has a direct consequence for a REMOVABLE fixture: `risks.risk_id ->
 * risk_treatment_decisions`/`... -> risk_assessments` are `ON DELETE
 * RESTRICT`, so a risk with either child row present can never be deleted
 * either, and `approvals.entity_id` (deliberately no FK, ADR-008) would be
 * left permanently orphaned if its parent risk were deleted regardless.
 * Confirmed by hand: the first real `--reset` run against a small batch
 * failed outright with `risk_treatment_decisions is append-only: DELETE is
 * not permitted`, the moment any decision row existed.
 *
 * Populating either table here would therefore make a real fraction of
 * this "disposable, explicitly-invoked, removable" fixture PERMANENTLY
 * stuck in the database — the opposite of what T200 asks for. Rather than
 * quietly accepting partial, silent irreversibility, this fixture simply
 * never writes to either table: `risk_treatment_actions` (genuinely
 * mutable, no append-only enforcement) is what the register's
 * `overdueTreatment` filter and the dashboard's overdue-actions/
 * treatment-actions tiles actually read, so the "treatment actions, some
 * overdue" half of T200's own instruction is still fully exercised at
 * scale; the "treatment decisions and approvals" half is not, and
 * `test/contract/dashboard.spec.ts`'s own small, real, fully-decided
 * approval fixtures already cover that endpoint's correctness — this file
 * exists for volume/performance, not for being the only place that
 * behavior is exercised at all. Reported as a scope reduction, not hidden.
 *
 * ## One further deliberate simplification
 *
 * `risks.current_assessment_id`/`current_treatment_id`/`pending_approval_id`
 * are left `NULL` even for risks that DO have a real assessment row backing
 * them. Verified by reading the actual consumers before making this call:
 * `RiskQueryService` (the register) and `DashboardQueryService` (this
 * phase's dashboard, `infrastructure/dashboard-query.service.ts`) both read
 * `risks.status`/`residual_level`/`next_review_on` and the child tables
 * (`risk_treatment_actions`) DIRECTLY — neither ever joins through these
 * pointers — and `RiskHistoryQueryService` queries every source table by
 * `riskId` directly, never through them either. The three areas this
 * fixture exists to exercise (register filters, dashboard aggregates,
 * history query) are therefore unaffected. What WOULD be affected — `GET
 * /risks/{id}`'s `currentAssessment` section showing `null` for a
 * performance-fixture risk that actually has an assessment — is out of
 * this task's scope and is called out here rather than silently shipped.
 */
import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ActionStatus, Prisma, RiskLevel, RiskStatus, type PrismaClient } from '@prisma/client';

import { AppConfigModule } from '../../src/infrastructure/config/config.module';
import { PrismaModule } from '../../src/infrastructure/prisma/prisma.module';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { RiskScoringService } from '../../src/modules/risk/domain/risk-scoring.service';

import { seedDefaultMethodology } from './methodology.seed';

import type {
  MethodologyConfiguration,
  RiskLevelValue,
} from '../../src/modules/risk/domain/methodology.schema';

@Module({ imports: [AppConfigModule, PrismaModule] })
class PerformanceSeedModule {}

const RISK_CODE_MARKER = 'PERF-';
const ORG_UNIT_MARKER = 'PERF-OU-';
const USER_EMAIL_MARKER = 'perf-';
const USER_EMAIL_DOMAIN = '@example.test';
const CATEGORY_MARKER = 'PERF-CAT-';
const TYPE_MARKER = 'PERF-TYPE-';
const ORIGIN_MARKER = 'PERF-ORIGIN-';

const DEFAULT_TARGET_RISK_COUNT = 50_000;
const ORG_UNIT_CHILD_COUNT = 20;
const USER_COUNT = 60;
const BATCH_SIZE = 2000;

const CATEGORY_DEFINITIONS = [
  { code: `${CATEGORY_MARKER}1`, name: 'Operacional (fixture)', weight: 30 },
  { code: `${CATEGORY_MARKER}2`, name: 'Financeiro (fixture)', weight: 25 },
  { code: `${CATEGORY_MARKER}3`, name: 'Estratégico (fixture)', weight: 20 },
  { code: `${CATEGORY_MARKER}4`, name: 'Conformidade (fixture)', weight: 15 },
  { code: `${CATEGORY_MARKER}5`, name: 'Tecnológico (fixture)', weight: 10 },
];

const TYPE_DEFINITIONS = [
  { code: `${TYPE_MARKER}1`, name: 'Interno (fixture)', weight: 60 },
  { code: `${TYPE_MARKER}2`, name: 'Externo (fixture)', weight: 40 },
];

const ORIGIN_DEFINITIONS = [
  { code: `${ORIGIN_MARKER}1`, name: 'Pessoas (fixture)', weight: 35 },
  { code: `${ORIGIN_MARKER}2`, name: 'Processos (fixture)', weight: 25 },
  { code: `${ORIGIN_MARKER}3`, name: 'Sistemas e Tecnologia (fixture)', weight: 25 },
  { code: `${ORIGIN_MARKER}4`, name: 'Eventos Externos (fixture)', weight: 15 },
];

/** Realistic register shape: most risks sit mid-lifecycle, few are brand
 * new or fully archived (T200's "not uniform" instruction). */
const STATUS_WEIGHTS: readonly { status: RiskStatus; weight: number }[] = [
  { status: RiskStatus.DRAFT, weight: 5 },
  { status: RiskStatus.IDENTIFIED, weight: 8 },
  { status: RiskStatus.ASSESSED, weight: 20 },
  { status: RiskStatus.UNDER_TREATMENT, weight: 27 },
  { status: RiskStatus.UNDER_REVIEW, weight: 10 },
  { status: RiskStatus.ACCEPTED, weight: 15 },
  { status: RiskStatus.CLOSED, weight: 12 },
  { status: RiskStatus.ARCHIVED, weight: 3 },
];

/** Every status from `ASSESSED` onward carries a real score (ADR-006's
 * transition table requires an assessment to reach `ASSESSED` at all). */
const ASSESSED_OR_LATER: ReadonlySet<RiskStatus> = new Set([
  RiskStatus.ASSESSED,
  RiskStatus.UNDER_TREATMENT,
  RiskStatus.UNDER_REVIEW,
  RiskStatus.ACCEPTED,
  RiskStatus.CLOSED,
  RiskStatus.ARCHIVED,
]);

/** `ASSESSED -> UNDER_TREATMENT` requires "treatment decision exists"
 * (ADR-006) — every status reachable only via that transition therefore
 * gets exactly one decision, matching the real lifecycle rule rather than
 * inventing an inconsistent fixture. */
const UNDER_TREATMENT_OR_LATER: ReadonlySet<RiskStatus> = new Set([
  RiskStatus.UNDER_TREATMENT,
  RiskStatus.UNDER_REVIEW,
  RiskStatus.ACCEPTED,
  RiskStatus.CLOSED,
  RiskStatus.ARCHIVED,
]);

const ACTION_STATUS_WEIGHTS: readonly { status: ActionStatus; weight: number }[] = [
  { status: ActionStatus.OPEN, weight: 35 },
  { status: ActionStatus.IN_PROGRESS, weight: 25 },
  { status: ActionStatus.COMPLETED, weight: 30 },
  { status: ActionStatus.CANCELLED, weight: 10 },
];

/** Sample rate of `UNDER_TREATMENT_OR_LATER` risks that additionally get
 * treatment actions (not every risk under treatment needs one modeled
 * action for the fixture's purpose — a 100% rate would roughly double the
 * total row count for no additional coverage of anything this task
 * measures). */
const TREATMENT_ACTION_SAMPLE_RATE = 0.4;

interface CliOptions {
  readonly reset: boolean;
  readonly targetCount: number;
}

function parseCliOptions(argv: readonly string[]): CliOptions {
  const reset = argv.includes('--reset');
  const countArg = argv.find((arg) => arg.startsWith('--count='));
  const targetCount = countArg
    ? Number.parseInt(countArg.slice('--count='.length), 10)
    : DEFAULT_TARGET_RISK_COUNT;

  if (!Number.isInteger(targetCount) || targetCount <= 0) {
    throw new Error(
      `performance.seed: --count must be a positive integer, got "${countArg ?? ''}".`,
    );
  }

  return { reset, targetCount };
}

function pickWeighted<T extends { weight: number }>(items: readonly T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1]!;
}

function randomInt(minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(Math.random() * (maxInclusive - minInclusive + 1));
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * `methodology.schema.ts`'s `RiskLevelValue` (T122's OWN domain type,
 * `RiskScoringService.score()`'s return shape) is a deliberately
 * Prisma-free plain string union — see that file's header for why. Its
 * member names are kept string-identical to `@prisma/client`'s `RiskLevel`
 * enum by hand, so a bracket lookup by name is the correct, narrow
 * conversion at this infrastructure boundary — the only place this script
 * crosses from the pure domain value to the column type.
 */
function toPrismaRiskLevel(value: RiskLevelValue): RiskLevel;
function toPrismaRiskLevel(value: RiskLevelValue | null): RiskLevel | null;
function toPrismaRiskLevel(value: RiskLevelValue | null): RiskLevel | null {
  return value === null ? null : RiskLevel[value];
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

interface OrgUnitPlan {
  readonly id: string;
  readonly code: string;
  readonly weight: number;
}

function buildOrgUnitPlan(): { root: OrgUnitPlan; children: OrgUnitPlan[] } {
  const root: OrgUnitPlan = { id: randomUUID(), code: `${ORG_UNIT_MARKER}ROOT`, weight: 6 };
  const children: OrgUnitPlan[] = Array.from(
    { length: ORG_UNIT_CHILD_COUNT },
    (_unused, index) => ({
      id: randomUUID(),
      code: `${ORG_UNIT_MARKER}${String(index + 1).padStart(3, '0')}`,
      // Zipf-like skew: unit #1 carries far more risk than unit #20.
      weight: 1 / (index + 1),
    }),
  );
  return { root, children };
}

async function ensureOrgUnits(
  client: PrismaClient,
  plan: { root: OrgUnitPlan; children: OrgUnitPlan[] },
): Promise<void> {
  await client.organizationalUnit.upsert({
    where: { code: plan.root.code },
    create: {
      id: plan.root.id,
      code: plan.root.code,
      name: 'Unidade Raiz (fixture de performance)',
      parentId: null,
      path: `/${plan.root.id}/`,
      depth: 0,
    },
    update: {},
  });

  for (const child of plan.children) {
    await client.organizationalUnit.upsert({
      where: { code: child.code },
      create: {
        id: child.id,
        code: child.code,
        name: `Unidade ${child.code} (fixture de performance)`,
        parentId: plan.root.id,
        path: `/${plan.root.id}/${child.id}/`,
        depth: 1,
      },
      update: {},
    });
  }
}

async function ensureReferenceData(client: PrismaClient): Promise<void> {
  for (const [index, def] of CATEGORY_DEFINITIONS.entries()) {
    await client.riskCategory.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        description: `Categoria de risco gerada para a carga de performance (${def.code}).`,
        sortOrder: index,
      },
      update: { name: def.name },
    });
  }
  for (const [index, def] of TYPE_DEFINITIONS.entries()) {
    await client.riskType.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        description: `Tipo de risco gerado para a carga de performance (${def.code}).`,
        sortOrder: index,
      },
      update: { name: def.name },
    });
  }
  for (const [index, def] of ORIGIN_DEFINITIONS.entries()) {
    await client.riskOrigin.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        description: `Origem de risco gerada para a carga de performance (${def.code}).`,
        sortOrder: index,
      },
      update: { name: def.name },
    });
  }
}

interface UserPlan {
  readonly id: string;
  readonly orgUnitId: string;
}

async function ensureUsers(
  client: PrismaClient,
  orgUnitIds: readonly string[],
): Promise<UserPlan[]> {
  const existing = await client.user.findMany({
    where: { email: { startsWith: USER_EMAIL_MARKER, endsWith: USER_EMAIL_DOMAIN } },
    select: { id: true, primaryOrgUnitId: true },
  });
  if (existing.length >= USER_COUNT) {
    return existing.map((user) => ({
      id: user.id,
      orgUnitId: user.primaryOrgUnitId ?? orgUnitIds[0]!,
    }));
  }

  const plans: UserPlan[] = Array.from({ length: USER_COUNT }, (_unused, index) => ({
    id: randomUUID(),
    orgUnitId: orgUnitIds[index % orgUnitIds.length]!,
  }));

  await client.user.createMany({
    data: plans.map((plan, index) => ({
      id: plan.id,
      email: `${USER_EMAIL_MARKER}user-${String(index + 1).padStart(4, '0')}${USER_EMAIL_DOMAIN}`,
      fullName: `Usuário de Performance ${String(index + 1).padStart(4, '0')}`,
      jobTitle: 'Fixture',
      primaryOrgUnitId: plan.orgUnitId,
    })),
    skipDuplicates: true,
  });

  return plans;
}

interface RiskPlan {
  readonly id: string;
  readonly code: string;
  readonly orgUnitId: string;
  readonly ownerUserId: string;
  readonly responsibleUserId: string | null;
  readonly categoryId: string;
  readonly typeId: string;
  readonly originId: string;
  readonly status: RiskStatus;
  readonly identifiedOn: Date;
  readonly lastAssessedOn: Date | null;
  readonly nextReviewOn: Date | null;
  readonly inherentProbability: number | null;
  readonly inherentImpact: number | null;
  readonly inherentScore: number | null;
  readonly inherentLevel: RiskLevelValue | null;
  readonly residualProbability: number | null;
  readonly residualImpact: number | null;
  readonly residualScore: number | null;
  readonly residualLevel: RiskLevelValue | null;
}

function buildRiskPlans(
  count: number,
  startingSequence: number,
  orgUnits: readonly OrgUnitPlan[],
  categoryIds: readonly string[],
  typeIds: readonly string[],
  originIds: readonly string[],
  users: readonly UserPlan[],
  methodology: MethodologyConfiguration,
): RiskPlan[] {
  const scoring = new RiskScoringService();
  const today = new Date();
  const categoryWeighted = CATEGORY_DEFINITIONS.map((def, index) => ({
    id: categoryIds[index]!,
    weight: def.weight,
  }));
  const typeWeighted = TYPE_DEFINITIONS.map((def, index) => ({
    id: typeIds[index]!,
    weight: def.weight,
  }));
  const originWeighted = ORIGIN_DEFINITIONS.map((def, index) => ({
    id: originIds[index]!,
    weight: def.weight,
  }));

  const plans: RiskPlan[] = [];
  for (let i = 0; i < count; i += 1) {
    const sequence = startingSequence + i;
    const orgUnit = pickWeighted(orgUnits);
    const owner = users[randomInt(0, users.length - 1)]!;
    const hasResponsible = Math.random() > 0.3;
    const responsible = hasResponsible ? users[randomInt(0, users.length - 1)]! : null;
    const { status } = pickWeighted(STATUS_WEIGHTS);

    const identifiedOn = addDays(today, -randomInt(30, 730));

    let inherentProbability: number | null = null;
    let inherentImpact: number | null = null;
    let inherentScore: number | null = null;
    let inherentLevel: RiskLevelValue | null = null;
    let residualProbability: number | null = null;
    let residualImpact: number | null = null;
    let residualScore: number | null = null;
    let residualLevel: RiskLevelValue | null = null;
    let lastAssessedOn: Date | null = null;
    let nextReviewOn: Date | null = null;

    if (ASSESSED_OR_LATER.has(status)) {
      // Indices into the METHODOLOGY'S OWN configured scales (never a
      // hardcoded 1-5 range) — a developer's active methodology may not
      // use contiguous integer scale points, so every factor picked here
      // is guaranteed to be a real scale member `RiskScoringService.score`
      // accepts, and "residual trends lower than inherent" is expressed as
      // a lower SCALE INDEX, ascending order being how every methodology
      // scale is authored (`methodology.schema.ts`'s own validation).
      const probabilityIndex = randomInt(0, methodology.probabilityScale.length - 1);
      const impactIndex = randomInt(0, methodology.impactScale.length - 1);
      inherentProbability = methodology.probabilityScale[probabilityIndex]!.value;
      inherentImpact = methodology.impactScale[impactIndex]!.value;
      const inherentResult = scoring.score(
        { probability: inherentProbability, impact: inherentImpact },
        methodology,
      );
      inherentScore = inherentResult.score;
      inherentLevel = inherentResult.level;

      // Treatment is assumed to reduce exposure — residual factors trend
      // lower than inherent, never higher (T200's "biased lower" design).
      // A modest, single-step-at-most reduction per dimension: subtracting
      // up to 2 steps from an already-uniform 0-4 index (tried first,
      // measured against the real 50,000-row fixture) collapsed the
      // residual distribution to almost nothing but LOW — every
      // `byResidualLevel` bucket except LOW and a handful of HIGH sat at
      // zero, which is exactly the uniform, unbelievable shape T200 warns
      // against, just moved to a different axis. `randomInt(0, 1)` keeps a
      // believable MEDIUM/HIGH/CRITICAL presence in the residual
      // distribution while still trending it below inherent.
      const residualProbabilityIndex = Math.max(0, probabilityIndex - randomInt(0, 1));
      const residualImpactIndex = Math.max(0, impactIndex - randomInt(0, 1));
      residualProbability = methodology.probabilityScale[residualProbabilityIndex]!.value;
      residualImpact = methodology.impactScale[residualImpactIndex]!.value;
      const residualResult = scoring.score(
        { probability: residualProbability, impact: residualImpact },
        methodology,
      );
      residualScore = residualResult.score;
      residualLevel = residualResult.level;

      lastAssessedOn = addDays(identifiedOn, randomInt(5, 60));
      if (lastAssessedOn.getTime() > today.getTime()) {
        lastAssessedOn = today;
      }

      if (status !== RiskStatus.CLOSED && status !== RiskStatus.ARCHIVED) {
        const overdue = Math.random() < 0.2;
        nextReviewOn = overdue
          ? addDays(today, -randomInt(1, 120))
          : addDays(lastAssessedOn, randomInt(120, 365));
      }
    }

    plans.push({
      id: randomUUID(),
      code: `${RISK_CODE_MARKER}${String(sequence).padStart(6, '0')}`,
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
      responsibleUserId: responsible?.id ?? null,
      categoryId: pickWeighted(categoryWeighted).id,
      typeId: pickWeighted(typeWeighted).id,
      originId: pickWeighted(originWeighted).id,
      status,
      identifiedOn,
      lastAssessedOn,
      nextReviewOn,
      inherentProbability,
      inherentImpact,
      inherentScore,
      inherentLevel,
      residualProbability,
      residualImpact,
      residualScore,
      residualLevel,
    });
  }
  return plans;
}

async function insertRisks(
  client: PrismaClient,
  plans: readonly RiskPlan[],
  methodologyVersionId: string,
): Promise<void> {
  for (const batch of chunk(plans, BATCH_SIZE)) {
    await client.risk.createMany({
      data: batch.map((plan) => ({
        id: plan.id,
        code: plan.code,
        title: `Risco de performance ${plan.code}`,
        description:
          'Registro sintético gerado por prisma/seed/performance.seed.ts (T200) para validação de performance em escala.',
        categoryId: plan.categoryId,
        typeId: plan.typeId,
        originId: plan.originId,
        orgUnitId: plan.orgUnitId,
        ownerUserId: plan.ownerUserId,
        responsibleUserId: plan.responsibleUserId,
        status: plan.status,
        inherentScore: plan.inherentScore,
        inherentLevel: toPrismaRiskLevel(plan.inherentLevel),
        residualScore: plan.residualScore,
        residualLevel: toPrismaRiskLevel(plan.residualLevel),
        identifiedOn: plan.identifiedOn,
        lastAssessedOn: plan.lastAssessedOn,
        nextReviewOn: plan.nextReviewOn,
      })),
      skipDuplicates: true,
    });

    const assessmentRows = batch
      .filter((plan) => ASSESSED_OR_LATER.has(plan.status))
      .map((plan) => ({
        id: randomUUID(),
        riskId: plan.id,
        methodologyVersionId,
        assessedByUserId: plan.ownerUserId,
        assessedOn: plan.lastAssessedOn!,
        inherentProbability: plan.inherentProbability!,
        inherentImpact: plan.inherentImpact!,
        inherentScore: plan.inherentScore!,
        inherentLevel: toPrismaRiskLevel(plan.inherentLevel!),
        residualProbability: plan.residualProbability!,
        residualImpact: plan.residualImpact!,
        residualScore: plan.residualScore!,
        residualLevel: toPrismaRiskLevel(plan.residualLevel!),
        rationale: 'Avaliação sintética gerada para a carga de performance (T200).',
      }));
    if (assessmentRows.length > 0) {
      await client.riskAssessment.createMany({ data: assessmentRows, skipDuplicates: true });
    }

    // `risk_treatment_decisions` and `approvals` are DELIBERATELY never
    // populated by this fixture — see the file header's "Why treatment
    // decisions and approvals are NOT part of this fixture" section.
    //
    // 007-implementation-remediation, Frente A, D-1/FR-009 — every
    // `UNDER_TREATMENT_OR_LATER` risk still gets real treatment-action
    // work, but `Action` (`grc/action`) is now the SOLE authority for it
    // (title/description/responsible/dueOn/status/completedAt); this
    // fixture writes `actions` directly (a genuinely mutable table, no
    // append-only enforcement) plus the reduced `risk_treatment_actions`
    // LINK row — never the retired six columns on the link table, which no
    // longer exist. This is what the register's `overdueTreatment` filter
    // and the dashboard's overdue-actions/treatment-actions tiles now
    // read (research.md D-7).
    const treatmentEligible = batch.filter((plan) => UNDER_TREATMENT_OR_LATER.has(plan.status));
    const today = new Date();
    interface PendingAction {
      readonly actionId: string;
      readonly linkId: string;
      readonly riskId: string;
      readonly orgUnitId: string;
      readonly title: string;
      readonly description: string;
      readonly responsibleUserId: string;
      readonly dueOn: Date;
      readonly status: ActionStatus;
      readonly completedAt: Date | null;
    }
    const pending: PendingAction[] = [];
    for (const plan of treatmentEligible) {
      if (Math.random() >= TREATMENT_ACTION_SAMPLE_RATE) {
        continue;
      }
      const actionCount = randomInt(1, 2);
      for (let a = 0; a < actionCount; a += 1) {
        const { status: actionStatus } = pickWeighted(ACTION_STATUS_WEIGHTS);
        const terminal =
          actionStatus === ActionStatus.COMPLETED || actionStatus === ActionStatus.CANCELLED;
        const overdue = !terminal && Math.random() < 0.4;
        const dueOn = overdue
          ? addDays(today, -randomInt(1, 90))
          : addDays(today, randomInt(1, 180));
        pending.push({
          actionId: randomUUID(),
          linkId: randomUUID(),
          riskId: plan.id,
          orgUnitId: plan.orgUnitId,
          title: `Ação de tratamento ${a + 1} (fixture de performance)`,
          description: 'Ação sintética gerada para a carga de performance (T200).',
          responsibleUserId: plan.responsibleUserId ?? plan.ownerUserId,
          dueOn,
          status: actionStatus,
          completedAt: actionStatus === ActionStatus.COMPLETED ? dueOn : null,
        });
      }
    }
    if (pending.length > 0) {
      const codes = await nextActionCodes(client, today.getUTCFullYear(), pending.length);
      const actionRows: Prisma.ActionCreateManyInput[] = pending.map((p, index) => ({
        id: p.actionId,
        code: codes[index]!,
        orgUnitId: p.orgUnitId,
        originType: 'RISK_TREATMENT',
        originId: p.riskId,
        title: p.title,
        description: p.description,
        responsibleUserId: p.responsibleUserId,
        dueOn: p.dueOn,
        status: p.status,
        completedAt: p.completedAt,
        completedByUserId: p.completedAt ? p.responsibleUserId : null,
      }));
      await client.action.createMany({ data: actionRows, skipDuplicates: true });

      const linkRows: Prisma.RiskTreatmentActionCreateManyInput[] = pending.map((p) => ({
        id: p.linkId,
        riskId: p.riskId,
        treatmentDecisionId: null,
        actionId: p.actionId,
      }));
      await client.riskTreatmentAction.createMany({ data: linkRows, skipDuplicates: true });
    }
  }
}

/**
 * 007-implementation-remediation, Frente A — reserves `count` sequential
 * codes for `year` from the shared `grc_code_sequences` table (the SAME
 * allocator `EntityCodeGeneratorPort` uses one row at a time,
 * `grc/shared/domain/entity-code.service.ts`), in ONE round trip rather
 * than `count` — this is a bulk seed script, not a request handler. Same
 * range-reservation shape as the Action-convergence migration's own
 * backfill (`prisma/migrations/20260911000000_.../migration.sql`).
 */
async function nextActionCodes(
  client: PrismaClient,
  year: number,
  count: number,
): Promise<readonly string[]> {
  await client.$executeRawUnsafe(
    `INSERT INTO grc_code_sequences (prefix, year, last_value) VALUES ('ACT', $1, 0)
     ON CONFLICT (prefix, year) DO NOTHING`,
    year,
  );
  const rows = await client.$queryRawUnsafe<{ last_value: number }[]>(
    `UPDATE grc_code_sequences SET last_value = last_value + $1
     WHERE prefix = 'ACT' AND year = $2
     RETURNING last_value`,
    count,
    year,
  );
  const endValue = rows[0]!.last_value;
  const startValue = endValue - count + 1;
  return Array.from(
    { length: count },
    (_unused, index) => `ACT-${year}-${String(startValue + index).padStart(4, '0')}`,
  );
}

/**
 * FK-safe deletion order: every pointer FROM a risk (its lifecycle
 * transitions, its treatment actions/decisions, its assessments) is
 * deleted before the risks themselves, and self-referencing chains
 * (`riskTreatmentDecision.supersededById`, `riskAssessment.previousAssessmentId`)
 * are removed by deleting every row for the marked risks in one statement
 * (safe — see `dashboard-query.service.ts`'s sibling reasoning on
 * statement-level constraint checking) rather than walking each chain.
 * `risks.current_assessment_id`/`current_treatment_id`/`pending_approval_id`
 * are left `NULL` by this fixture (see file header), so there is no
 * pointer on the `risks` row itself to clear first.
 */
async function cleanupPerformanceFixture(client: PrismaClient): Promise<void> {
  const riskIdRows = await client.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM risks WHERE code LIKE ${`${RISK_CODE_MARKER}%`}`,
  );
  const riskIds = riskIdRows.map((row) => row.id);

  // `risk_treatment_decisions` and `approvals` are NOT deleted here because
  // this fixture never inserts into either (see the file header) — there is
  // nothing of this fixture's own to remove from those two tables.
  for (const idBatch of chunk(riskIds, BATCH_SIZE)) {
    await client.$executeRaw(Prisma.sql`
      DELETE FROM risk_treatment_actions WHERE risk_id = ANY(${idBatch}::uuid[])
    `);
    await client.$executeRaw(Prisma.sql`
      DELETE FROM risk_assessments WHERE risk_id = ANY(${idBatch}::uuid[])
    `);
  }

  await client.$executeRaw(Prisma.sql`DELETE FROM risks WHERE code LIKE ${`${RISK_CODE_MARKER}%`}`);
  await client.$executeRaw(
    Prisma.sql`DELETE FROM users WHERE email LIKE ${`${USER_EMAIL_MARKER}%${USER_EMAIL_DOMAIN}`}`,
  );
  await client.$executeRaw(
    Prisma.sql`DELETE FROM organizational_units WHERE code LIKE ${`${ORG_UNIT_MARKER}%`}`,
  );
  await client.$executeRaw(
    Prisma.sql`DELETE FROM risk_categories WHERE code LIKE ${`${CATEGORY_MARKER}%`}`,
  );
  await client.$executeRaw(Prisma.sql`DELETE FROM risk_types WHERE code LIKE ${`${TYPE_MARKER}%`}`);
  await client.$executeRaw(
    Prisma.sql`DELETE FROM risk_origins WHERE code LIKE ${`${ORIGIN_MARKER}%`}`,
  );
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const appContext = await NestFactory.createApplicationContext(PerformanceSeedModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = appContext.get(PrismaService);
    const client = prisma.client as PrismaClient;

    if (options.reset) {
      console.log('[performance.seed] --reset: removing every PERF- tagged row...');
      await cleanupPerformanceFixture(client);
      console.log('[performance.seed] Done. The database is left as it was before seeding.');
      return;
    }

    const existingCount = await client.risk.count({
      where: { code: { startsWith: RISK_CODE_MARKER } },
    });
    if (existingCount >= options.targetCount) {
      console.log(
        `[performance.seed] Already seeded (${String(existingCount)} PERF- risks >= requested ` +
          `${String(options.targetCount)}). Nothing to do — idempotent no-op. Run with --reset first ` +
          'to reseed a different --count.',
      );
      return;
    }
    if (existingCount > 0) {
      throw new Error(
        `performance.seed: ${String(existingCount)} PERF- risks already exist, fewer than the ` +
          `requested ${String(options.targetCount)}. Run with --reset first rather than guessing ` +
          'whether this is a smaller prior run or a partial failure.',
      );
    }

    console.log('[performance.seed] Seeding organizational units, reference data and users...');
    const orgUnitPlan = buildOrgUnitPlan();
    await ensureOrgUnits(client, orgUnitPlan);
    await ensureReferenceData(client);
    const allOrgUnits = [orgUnitPlan.root, ...orgUnitPlan.children];
    const users = await ensureUsers(
      client,
      allOrgUnits.map((unit) => unit.id),
    );

    const categoryIds = CATEGORY_DEFINITIONS.map((def) => def.code);
    const typeIds = TYPE_DEFINITIONS.map((def) => def.code);
    const originIds = ORIGIN_DEFINITIONS.map((def) => def.code);
    const [categoryRows, typeRows, originRows] = await Promise.all([
      client.riskCategory.findMany({
        where: { code: { in: categoryIds } },
        select: { id: true, code: true },
      }),
      client.riskType.findMany({
        where: { code: { in: typeIds } },
        select: { id: true, code: true },
      }),
      client.riskOrigin.findMany({
        where: { code: { in: originIds } },
        select: { id: true, code: true },
      }),
    ]);
    const categoryIdByCode = new Map(categoryRows.map((row) => [row.code, row.id]));
    const typeIdByCode = new Map(typeRows.map((row) => [row.code, row.id]));
    const originIdByCode = new Map(originRows.map((row) => [row.code, row.id]));
    const categoryRefIds = categoryIds.map((code) => categoryIdByCode.get(code)!);
    const typeRefIds = typeIds.map((code) => typeIdByCode.get(code)!);
    const originRefIds = originIds.map((code) => originIdByCode.get(code)!);

    console.log('[performance.seed] Ensuring an active risk methodology exists...');
    const methodologyResult = await seedDefaultMethodology(client, users[0]!.id);
    const versionRow = await client.riskMethodologyVersion.findUniqueOrThrow({
      where: { id: methodologyResult.versionId },
    });
    const methodology: MethodologyConfiguration = {
      probabilityScale:
        versionRow.probabilityScale as unknown as MethodologyConfiguration['probabilityScale'],
      impactScale: versionRow.impactScale as unknown as MethodologyConfiguration['impactScale'],
      matrix: versionRow.matrix as unknown as MethodologyConfiguration['matrix'],
      levelBands: versionRow.levelBands as unknown as MethodologyConfiguration['levelBands'],
    };

    const toCreate = options.targetCount - existingCount;
    console.log(
      `[performance.seed] Generating and inserting ${String(toCreate)} risks in batches of ${String(BATCH_SIZE)}...`,
    );

    const startTime = Date.now();
    let inserted = 0;
    while (inserted < toCreate) {
      const batchCount = Math.min(BATCH_SIZE, toCreate - inserted);
      const plans = buildRiskPlans(
        batchCount,
        existingCount + inserted + 1,
        allOrgUnits,
        categoryRefIds,
        typeRefIds,
        originRefIds,
        users,
        methodology,
      );
      await insertRisks(client, plans, methodologyResult.versionId);
      inserted += batchCount;
      console.log(`[performance.seed]   ${String(inserted)}/${String(toCreate)} risks inserted...`);
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    const finalCount = await client.risk.count({
      where: { code: { startsWith: RISK_CODE_MARKER } },
    });
    console.log(
      `[performance.seed] Done in ${elapsedSeconds}s. ${String(finalCount)} PERF- risks now present.`,
    );
  } finally {
    await appContext.close();
  }
}

main().catch((error: unknown) => {
  console.error('[performance.seed] Failed:', error);
  process.exitCode = 1;
});
