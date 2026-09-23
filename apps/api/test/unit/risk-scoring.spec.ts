import { describe, expect, it } from 'vitest';

import { RiskScoringService } from '../../src/modules/risk/domain/risk-scoring.service';

import type {
  LevelBandConfig,
  MethodologyConfiguration,
  RiskLevelValue,
} from '../../src/modules/risk/domain/methodology.schema';

const LEVEL_BANDS: readonly LevelBandConfig[] = [
  { level: 'LOW', minScore: 1, maxScore: 4 },
  { level: 'MEDIUM', minScore: 5, maxScore: 9 },
  { level: 'HIGH', minScore: 10, maxScore: 15 },
  { level: 'CRITICAL', minScore: 16, maxScore: 25 },
];

function levelForScore(score: number): RiskLevelValue {
  const band = LEVEL_BANDS.find((b) => score >= b.minScore && score <= b.maxScore);
  if (!band) {
    throw new Error(`test fixture: no band covers score=${String(score)}`);
  }
  return band.level;
}

const SCALE_1_TO_5 = [1, 2, 3, 4, 5].map((value) => ({ value, label: `P${String(value)}` }));

const PRODUCT_MATRIX_VERSION: MethodologyConfiguration = {
  probabilityScale: SCALE_1_TO_5,
  impactScale: SCALE_1_TO_5,
  matrix: SCALE_1_TO_5.flatMap((p) =>
    SCALE_1_TO_5.map((i) => ({
      probability: p.value,
      impact: i.value,
      score: p.value * i.value,
      level: levelForScore(p.value * i.value),
    })),
  ),
  levelBands: LEVEL_BANDS,
};

const SCALE_1_TO_25 = Array.from({ length: 25 }, (_, index) => ({
  value: index + 1,
  label: `P${String(index + 1)}`,
}));

const FULL_RANGE_VERSION: MethodologyConfiguration = {
  probabilityScale: SCALE_1_TO_25,
  impactScale: [{ value: 1, label: 'I1' }],
  matrix: SCALE_1_TO_25.map((p) => ({
    probability: p.value,
    impact: 1,
    score: p.value,
    level: levelForScore(p.value),
  })),
  levelBands: LEVEL_BANDS,
};

describe('RiskScoringService.score (T122/T114) — exhaustive matrix cells', () => {
  const service = new RiskScoringService();

  it.each(
    PRODUCT_MATRIX_VERSION.matrix.map(
      (cell) => [cell.probability, cell.impact, cell.score, cell.level] as const,
    ),
  )(
    'probability=%i, impact=%i -> score=%i, level=%s',
    (probability, impact, expectedScore, expectedLevel) => {
      const result = service.score({ probability, impact }, PRODUCT_MATRIX_VERSION);
      expect(result.score).toBe(expectedScore);
      expect(result.level).toBe(expectedLevel);
    },
  );

  it('covers exactly the 25 cells of the 5x5 matrix — no cell skipped, no duplicate', () => {
    expect(PRODUCT_MATRIX_VERSION.matrix).toHaveLength(25);
    const keys = new Set(
      PRODUCT_MATRIX_VERSION.matrix.map((c) => `${String(c.probability)}:${String(c.impact)}`),
    );
    expect(keys.size).toBe(25);
  });
});

describe('RiskScoringService.score (T122/T114) — every score 1-25, both sides of every band boundary', () => {
  const service = new RiskScoringService();

  it.each(FULL_RANGE_VERSION.matrix.map((cell) => [cell.score, cell.level] as const))(
    'score=%i -> level=%s',
    (score, expectedLevel) => {
      const result = service.score({ probability: score, impact: 1 }, FULL_RANGE_VERSION);
      expect(result.score).toBe(score);
      expect(result.level).toBe(expectedLevel);
    },
  );

  it.each([
    [4, 'LOW'],
    [5, 'MEDIUM'],
    [9, 'MEDIUM'],
    [10, 'HIGH'],
    [15, 'HIGH'],
    [16, 'CRITICAL'],
  ] as const)('boundary: score=%i -> %s', (score, expectedLevel) => {
    const result = service.score({ probability: score, impact: 1 }, FULL_RANGE_VERSION);
    expect(result.level).toBe(expectedLevel);
  });

  it('covers the full attainable range with no gap and no overlap', () => {
    const scores = FULL_RANGE_VERSION.matrix.map((c) => c.score).sort((a, b) => a - b);
    expect(scores).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
});
