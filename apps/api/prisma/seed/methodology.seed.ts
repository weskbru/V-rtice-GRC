/**
 * T123 — the default 5×5 risk methodology and its first version
 * (data-model.md §7: "Default seed: a 5×5 matrix with bands low / medium /
 * high / critical").
 *
 * ## The 5×5 matrix
 *
 * Classic COSO ERM likelihood/impact scale, `score = probability × impact`
 * (range 1-25), with contiguous, non-overlapping bands covering that whole
 * range: LOW 1-4, MEDIUM 5-9, HIGH 10-15, CRITICAL 16-25. Every cell below
 * was computed from that rule and is exhaustively verified against
 * `validateMethodologyConfiguration` in this seed's own test coverage
 * (T114/T117's exhaustive scoring tests exercise the SAME matrix via
 * `RiskScoringService`, so a mismatch here would fail those, not just this
 * file).
 *
 * `colorToken` is set to the `RiskLevel` value itself
 * (`packages/design-system/src/tokens/colors.ts`'s `riskSeverityLight`/
 * `riskSeverityDark` are keyed directly by `RiskLevel`, not by a separate
 * token-name string) — an interpretive choice, since the field is optional
 * in `contracts/platform.openapi.yaml`'s `LevelBand` and this task does not
 * touch the design-system package.
 *
 * ## No actor to attribute to (same reasoning as `platform.seed.ts`)
 *
 * `createdByUserId` must reference a REAL `User` row (FK, restrict) — this
 * seed runs `platform.seed.ts`'s bootstrap administrator's id (already
 * seeded by the time this runs, per `prisma/seed/index.ts`'s ordering) as
 * the attributed creator, exactly the same "no real actor exists yet, so
 * attribute to the platform bootstrap identity" reasoning `admin.seed.ts`
 * already establishes for other platform-seeded rows. No `audit_event` row
 * is written for this seed, for the identical reason `platform.seed.ts`/
 * `risk-reference.seed.ts` do not: there is no request context to attribute
 * a "methodology created" event to at seed time.
 *
 * ## Idempotency
 *
 * `RiskMethodologyVersion` is append-only — there is no upsert-on-conflict
 * path available (see the baseline migration's header: the application
 * role has no `UPDATE` privilege on this table at all). Idempotency is
 * achieved instead by CHECKING first: if an active methodology already
 * exists, this seed does nothing and returns its existing id/version count
 * unchanged — running it twice produces IDENTICAL row counts, proven by
 * running it twice and diffing counts (see the implementation report).
 */
import type {
  LevelBandConfig,
  MatrixCellConfig,
  RiskLevelValue,
  ScalePointConfig,
} from '../../src/modules/risk/domain/methodology.schema';
import type { Prisma, PrismaClient } from '@prisma/client';

const DEFAULT_METHODOLOGY_NAME = 'Metodologia Padrão 5x5';

const PROBABILITY_SCALE: readonly ScalePointConfig[] = [
  { value: 1, label: 'Raro', description: 'Pode ocorrer apenas em circunstâncias excepcionais.' },
  { value: 2, label: 'Improvável', description: 'Pode ocorrer em algum momento.' },
  { value: 3, label: 'Possível', description: 'Deve ocorrer em algum momento.' },
  {
    value: 4,
    label: 'Provável',
    description: 'Provavelmente ocorrerá na maioria das circunstâncias.',
  },
  {
    value: 5,
    label: 'Quase certo',
    description: 'Espera-se que ocorra na maioria das circunstâncias.',
  },
];

const IMPACT_SCALE: readonly ScalePointConfig[] = [
  { value: 1, label: 'Insignificante', description: 'Impacto mínimo, facilmente absorvido.' },
  { value: 2, label: 'Menor', description: 'Impacto pequeno, gerenciável com recursos normais.' },
  { value: 3, label: 'Moderado', description: 'Impacto relevante, requer atenção da gestão.' },
  { value: 4, label: 'Maior', description: 'Impacto significativo aos objetivos da organização.' },
  {
    value: 5,
    label: 'Catastrófico',
    description: 'Impacto severo, ameaça a continuidade do negócio.',
  },
];

const LEVEL_BANDS: readonly LevelBandConfig[] = [
  { level: 'LOW', minScore: 1, maxScore: 4, colorToken: 'LOW' },
  { level: 'MEDIUM', minScore: 5, maxScore: 9, colorToken: 'MEDIUM' },
  { level: 'HIGH', minScore: 10, maxScore: 15, colorToken: 'HIGH' },
  { level: 'CRITICAL', minScore: 16, maxScore: 25, colorToken: 'CRITICAL' },
];

function levelForScore(score: number): RiskLevelValue {
  const band = LEVEL_BANDS.find((b) => score >= b.minScore && score <= b.maxScore);
  if (!band) {
    throw new Error(`methodology.seed: no band covers score=${String(score)}.`);
  }
  return band.level;
}

function buildMatrix(): readonly MatrixCellConfig[] {
  const cells: MatrixCellConfig[] = [];
  for (const probabilityPoint of PROBABILITY_SCALE) {
    for (const impactPoint of IMPACT_SCALE) {
      const score = probabilityPoint.value * impactPoint.value;
      cells.push({
        probability: probabilityPoint.value,
        impact: impactPoint.value,
        score,
        level: levelForScore(score),
      });
    }
  }
  return cells;
}

export interface MethodologySeedResult {
  readonly methodologyId: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly created: boolean;
}

export async function seedDefaultMethodology(
  prisma: PrismaClient,
  bootstrapUserId: string,
): Promise<MethodologySeedResult> {
  const existingActive = await prisma.riskMethodology.findFirst({
    where: { isActive: true },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  });

  if (existingActive) {
    const existingVersion = existingActive.versions[0];
    if (!existingVersion) {
      throw new Error(
        `methodology.seed: active methodology "${existingActive.id}" has no version — ` +
          'this should never happen (a methodology is only ever created together with its first version).',
      );
    }
    return {
      methodologyId: existingActive.id,
      versionId: existingVersion.id,
      versionNumber: existingVersion.versionNumber,
      created: false,
    };
  }

  const matrix = buildMatrix();

  return prisma.$transaction(async (tx) => {
    const methodology = await tx.riskMethodology.create({
      data: { name: DEFAULT_METHODOLOGY_NAME, isActive: true },
    });

    const version = await tx.riskMethodologyVersion.create({
      data: {
        methodologyId: methodology.id,
        versionNumber: 1,
        // `Prisma.InputJsonValue` requires plain objects with a string
        // index signature; the domain's `readonly`, precisely-typed
        // interfaces (`ScalePointConfig`/`MatrixCellConfig`/
        // `LevelBandConfig`) are structurally JSON-compatible but not
        // assignable without this cast — genuinely required (unlike the
        // `as unknown as object` this replaced, which `tsc` rejected
        // outright once actually checked against Prisma's stricter JSON
        // input type).
        probabilityScale: PROBABILITY_SCALE as unknown as Prisma.InputJsonValue,
        impactScale: IMPACT_SCALE as unknown as Prisma.InputJsonValue,
        matrix: matrix as unknown as Prisma.InputJsonValue,
        levelBands: LEVEL_BANDS as unknown as Prisma.InputJsonValue,
        effectiveFrom: new Date(),
        createdByUserId: bootstrapUserId,
      },
    });

    return {
      methodologyId: methodology.id,
      versionId: version.id,
      versionNumber: version.versionNumber,
      created: true,
    };
  });
}
