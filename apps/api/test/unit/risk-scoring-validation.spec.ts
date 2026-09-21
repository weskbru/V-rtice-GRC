/**
 * T115 — FR-067: `RiskScoringService.score()` rejects a factor value that is
 * not a member of the configured scale, with a field-level
 * `ValidationDomainError` (422 territory), and never falls through to a
 * silent/incorrect score.
 */
import { describe, expect, it } from 'vitest';

import { RiskScoringService } from '../../src/modules/risk/domain/risk-scoring.service';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';

import type { MethodologyConfiguration } from '../../src/modules/risk/domain/methodology.schema';

const SCALE_1_TO_5 = [1, 2, 3, 4, 5].map((value) => ({ value, label: `P${String(value)}` }));

const METHODOLOGY_VERSION: MethodologyConfiguration = {
  probabilityScale: SCALE_1_TO_5,
  impactScale: SCALE_1_TO_5,
  matrix: SCALE_1_TO_5.flatMap((p) =>
    SCALE_1_TO_5.map((i) => ({
      probability: p.value,
      impact: i.value,
      score: p.value * i.value,
      level: p.value * i.value <= 4 ? ('LOW' as const) : ('MEDIUM' as const),
    })),
  ),
  levelBands: [
    { level: 'LOW', minScore: 1, maxScore: 4 },
    { level: 'MEDIUM', minScore: 5, maxScore: 25 },
  ],
};

describe('RiskScoringService.score (T115, FR-067) — out-of-scale factors rejected', () => {
  const service = new RiskScoringService();

  it('accepts a valid (probability, impact) pair — sanity baseline', () => {
    expect(() => service.score({ probability: 3, impact: 3 }, METHODOLOGY_VERSION)).not.toThrow();
  });

  it.each([0, 6, -1, 100])('rejects an out-of-scale probability value: %i', (probability) => {
    expect(() => service.score({ probability, impact: 3 }, METHODOLOGY_VERSION)).toThrow(
      ValidationDomainError,
    );
  });

  it.each([0, 6, -1, 100])('rejects an out-of-scale impact value: %i', (impact) => {
    expect(() => service.score({ probability: 3, impact }, METHODOLOGY_VERSION)).toThrow(
      ValidationDomainError,
    );
  });

  it('attributes the error to the "probability" field when probability is out of scale', () => {
    try {
      service.score({ probability: 99, impact: 3 }, METHODOLOGY_VERSION);
      throw new Error('expected score() to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationDomainError);
      const validationError = error as ValidationDomainError;
      expect(validationError.errors).toHaveLength(1);
      expect(validationError.errors[0]!.field).toBe('probability');
    }
  });

  it('attributes the error to the "impact" field when impact is out of scale', () => {
    try {
      service.score({ probability: 3, impact: 99 }, METHODOLOGY_VERSION);
      throw new Error('expected score() to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationDomainError);
      const validationError = error as ValidationDomainError;
      expect(validationError.errors).toHaveLength(1);
      expect(validationError.errors[0]!.field).toBe('impact');
    }
  });

  it('checks probability before impact when both are out of scale (deterministic, single-field error)', () => {
    try {
      service.score({ probability: 99, impact: 99 }, METHODOLOGY_VERSION);
      throw new Error('expected score() to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationDomainError);
      const validationError = error as ValidationDomainError;
      expect(validationError.errors[0]!.field).toBe('probability');
    }
  });

  it('never returns a score/level for a rejected input (fails closed, not with a best-effort guess)', () => {
    let result: unknown;
    try {
      result = service.score({ probability: 42, impact: 1 }, METHODOLOGY_VERSION);
    } catch {
      result = undefined;
    }
    expect(result).toBeUndefined();
  });
});
