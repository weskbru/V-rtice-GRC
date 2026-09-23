import { describe, expect, it } from 'vitest';

import { isActionOverdue, todayDateOnlyUtc } from '../../src/grc/shared/domain/overdue.service';

const TODAY = new Date(Date.UTC(2026, 5, 15));
const PAST = new Date(Date.UTC(2026, 5, 14));
const FUTURE = new Date(Date.UTC(2026, 5, 16));

describe('isActionOverdue (T011/R-006, FR-014, SC-007)', () => {
  it('is true when dueOn has passed and status is OPEN', () => {
    expect(isActionOverdue(PAST, 'OPEN', TODAY)).toBe(true);
  });

  it('is true when dueOn has passed and status is IN_PROGRESS', () => {
    expect(isActionOverdue(PAST, 'IN_PROGRESS', TODAY)).toBe(true);
  });

  it('is false when dueOn has passed but status is COMPLETED (terminal)', () => {
    expect(isActionOverdue(PAST, 'COMPLETED', TODAY)).toBe(false);
  });

  it('is false when dueOn has passed but status is CANCELLED (terminal)', () => {
    expect(isActionOverdue(PAST, 'CANCELLED', TODAY)).toBe(false);
  });

  it('is false when dueOn is exactly today (due today is not yet overdue)', () => {
    expect(isActionOverdue(TODAY, 'OPEN', TODAY)).toBe(false);
  });

  it('is false when dueOn is in the future', () => {
    expect(isActionOverdue(FUTURE, 'OPEN', TODAY)).toBe(false);
  });
});

describe('todayDateOnlyUtc (T011)', () => {
  it('returns a UTC-midnight Date for the current day', () => {
    const today = todayDateOnlyUtc();
    expect(today.getUTCHours()).toBe(0);
    expect(today.getUTCMinutes()).toBe(0);
    expect(today.getUTCSeconds()).toBe(0);
    expect(today.getUTCMilliseconds()).toBe(0);
  });
});
