/**
 * T105/007-implementation-remediation Frente A, D-7 — unit coverage for
 * `isOverdueReview`, the one predicate left in
 * `modules/risk/domain/risk-overdue.ts`. `isOverdueTreatmentAction` was
 * REMOVED (D-7: `Action` is the sole authority for a risk treatment
 * action's status/due date now, D-1) — its equivalent coverage lives in
 * `test/unit/grc-overdue.spec.ts` against
 * `grc/shared/domain/overdue.service.ts#isActionOverdue`, the ONE shared
 * predicate that replaced it.
 */
import { describe, expect, it } from 'vitest';

import { isOverdueReview } from '../../src/modules/risk/domain/risk-overdue';

const TODAY = new Date(Date.UTC(2026, 5, 15)); // 2026-06-15
const PAST = new Date(Date.UTC(2026, 5, 14));
const FUTURE = new Date(Date.UTC(2026, 5, 16));

describe('isOverdueReview (T105, FR-070)', () => {
  it('is false when nextReviewOn is undefined', () => {
    expect(isOverdueReview(undefined, TODAY)).toBe(false);
  });

  it('is false when nextReviewOn is exactly today (due today is not yet overdue)', () => {
    expect(isOverdueReview(TODAY, TODAY)).toBe(false);
  });

  it('is true when nextReviewOn is strictly in the past', () => {
    expect(isOverdueReview(PAST, TODAY)).toBe(true);
  });

  it('is false when nextReviewOn is in the future', () => {
    expect(isOverdueReview(FUTURE, TODAY)).toBe(false);
  });
});
