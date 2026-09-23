import { describe, expect, it } from 'vitest';

import { isOverdueReview } from '../../src/modules/risk/domain/risk-overdue';

const TODAY = new Date(Date.UTC(2026, 5, 15));
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
