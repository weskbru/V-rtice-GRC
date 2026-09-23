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
