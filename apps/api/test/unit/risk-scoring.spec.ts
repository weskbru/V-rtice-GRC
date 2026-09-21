/**
 * T114 — `RiskScoringService.score()` (ADR-006, T122). Exhaustive by
 * construction, not a sample:
 *
 *  1. Every one of the 25 cells of the default 5×5 matrix (product-based
 *     scoring, matching `prisma/seed/methodology.seed.ts`'s default
 *     configuration) is asserted individually.
 *  2. Every score from 1 to 25 — the full attainable range — is asserted
 *     against a second, purpose-built single-impact-value configuration,
 *     so BOTH sides of every band boundary (4/5, 9/10, 15/16) are covered,
 *     including scores the 5×5 product grid never happens to produce on
 *     its own (e.g. 7, 11, 13, 14, 17-19, 21-24).
 *
 * ADR-006's own rationale: "Putting scoring in a pure function makes
 * exhaustive matrix-cell and band-boundary testing trivial" — this file is
 * that proof, run with no database, no NestJS module and no mocks.
 */
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

// --- Fixture 1: the default 5×5 product-based matrix -----------------------

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

// --- Fixture 2: single impact value, probability 1..25 — every attainable
// score in the full 1-25 range, so every band boundary is exercised on both
// sides regardless of which scores the 5x5 product grid happens to hit. ---

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

  // Explicit, named boundary assertions (redundant with the sweep above by
  // construction, but make the intent — "both sides of every boundary" —
  // impossible to miss on review).
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
