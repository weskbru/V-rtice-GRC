/**
 * 009-indicators-reports, Fase 2 (T013) — `evaluateThresholdBreach`
 * (data-model.md §4, spec.md FR-016/FR-019). No I/O, no NestJS container —
 * matches `risk-scoring.spec.ts`'s own "pure function, exhaustive by
 * construction" shape.
 *
 * Covers the four comparators, both sides of the boundary for each
 * (exact-equality behavior is exactly where GTE/LTE differ from GT/LT —
 * spec.md's own warning in this task's brief), and the "no threshold
 * configured" case (FR-019) via every combination of a null comparator/
 * value.
 */
import { describe, expect, it } from 'vitest';

import { evaluateThresholdBreach } from '../../src/modules/indicators/domain/indicator-threshold';

describe('evaluateThresholdBreach (T013, data-model.md §4)', () => {
  describe('no threshold configured (FR-019) — never breaches', () => {
    it('returns false when both comparator and thresholdValue are null', () => {
      expect(evaluateThresholdBreach(null, 999, null)).toBe(false);
    });

    it('returns false when comparator is null but a thresholdValue is present (malformed input, fails safe)', () => {
      expect(evaluateThresholdBreach(null, 999, 10)).toBe(false);
    });

    it('returns false when thresholdValue is null but a comparator is present (malformed input, fails safe)', () => {
      expect(evaluateThresholdBreach('GTE', 999, null)).toBe(false);
    });
  });

  describe('GTE — greater than or equal', () => {
    it('breaches when value is strictly greater than the threshold', () => {
      expect(evaluateThresholdBreach('GTE', 11, 10)).toBe(true);
    });

    it('breaches at exact equality — the GTE/GT boundary', () => {
      expect(evaluateThresholdBreach('GTE', 10, 10)).toBe(true);
    });

    it('does not breach when value is strictly below the threshold', () => {
      expect(evaluateThresholdBreach('GTE', 9, 10)).toBe(false);
    });
  });

  describe('GT — strictly greater than', () => {
    it('breaches when value is strictly greater than the threshold', () => {
      expect(evaluateThresholdBreach('GT', 11, 10)).toBe(true);
    });

    it('does NOT breach at exact equality — the GTE/GT boundary', () => {
      expect(evaluateThresholdBreach('GT', 10, 10)).toBe(false);
    });

    it('does not breach when value is strictly below the threshold', () => {
      expect(evaluateThresholdBreach('GT', 9, 10)).toBe(false);
    });
  });

  describe('LTE — less than or equal', () => {
    it('breaches when value is strictly below the threshold', () => {
      expect(evaluateThresholdBreach('LTE', 9, 10)).toBe(true);
    });

    it('breaches at exact equality — the LTE/LT boundary', () => {
      expect(evaluateThresholdBreach('LTE', 10, 10)).toBe(true);
    });

    it('does not breach when value is strictly above the threshold', () => {
      expect(evaluateThresholdBreach('LTE', 11, 10)).toBe(false);
    });
  });

  describe('LT — strictly less than', () => {
    it('breaches when value is strictly below the threshold', () => {
      expect(evaluateThresholdBreach('LT', 9, 10)).toBe(true);
    });

    it('does NOT breach at exact equality — the LTE/LT boundary', () => {
      expect(evaluateThresholdBreach('LT', 10, 10)).toBe(false);
    });

    it('does not breach when value is strictly above the threshold', () => {
      expect(evaluateThresholdBreach('LT', 11, 10)).toBe(false);
    });
  });

  describe('negative and fractional values — no special-casing of sign or integrality', () => {
    it('GTE handles negative values correctly', () => {
      expect(evaluateThresholdBreach('GTE', -5, -10)).toBe(true);
      expect(evaluateThresholdBreach('GTE', -15, -10)).toBe(false);
    });

    it('LTE handles fractional values at the boundary', () => {
      expect(evaluateThresholdBreach('LTE', 99.5, 99.5)).toBe(true);
      expect(evaluateThresholdBreach('LTE', 99.51, 99.5)).toBe(false);
    });
  });
});
