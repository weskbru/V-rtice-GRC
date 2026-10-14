import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ActionStatus, Prisma, RiskLevel, RiskStatus, type PrismaClient } from '@prisma/client';

import { AppConfigModule } from '../src/infrastructure/config/config.module';
import { PrismaModule } from '../src/infrastructure/prisma/prisma.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RiskScoringService } from '../src/modules/risk/domain/risk-scoring.service';

import { seedDefaultMethodology } from './methodology.seed';

import type {
  MethodologyConfiguration,
  RiskLevelValue,
} from '../src/modules/risk/domain/methodology.schema';

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

const ASSESSED_OR_LATER: ReadonlySet<RiskStatus> = new Set([
  RiskStatus.ASSESSED,
  RiskStatus.UNDER_TREATMENT,
  RiskStatus.UNDER_REVIEW,
  RiskStatus.ACCEPTED,
  RiskStatus.CLOSED,
  RiskStatus.ARCHIVED,
]);

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
          'Registro sintético gerado por seeds/performance.seed.ts (T200) para validação de performance em escala.',
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

async function cleanupPerformanceFixture(client: PrismaClient): Promise<void> {
  const riskIdRows = await client.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM risks WHERE code LIKE ${`${RISK_CODE_MARKER}%`}`,
  );
  const riskIds = riskIdRows.map((row) => row.id);

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
