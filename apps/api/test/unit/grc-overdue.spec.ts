/**
 * T015/002-shared-grc-foundation — unit coverage for the pure domain
 * predicate in `grc/shared/domain/overdue.service.ts`: `isActionOverdue`
 * (R-006, FR-014, SC-007). No I/O, no framework — mirrors
 * `test/unit/risk-overdue.spec.ts`'s structure for its
 * `isOverdueTreatmentAction` cousin, minus the "defaults when omitted"
 * case: `isActionOverdue` takes `referenceDate` as a REQUIRED parameter
 * with no default (see that function's own header for why), so there is no
 * "omitted" call shape to cover — every call site names its reference date
 * explicitly, which is exactly what the other cases below exercise.
 *
 * Covers, per this task's explicit checklist: a future due date, due
 * today, a past due date, and each of `Action`'s two terminal statuses
 * (`COMPLETED`, `CANCELLED`) — plus both eligible statuses (`OPEN`,
 * `IN_PROGRESS`) with a past due date, so every `ActionStatus` member is
 * exercised at least once.
 */
import { describe, expect, it } from 'vitest';

import { isActionOverdue, todayDateOnlyUtc } from '../../src/grc/shared/domain/overdue.service';

const TODAY = new Date(Date.UTC(2026, 5, 15)); // 2026-06-15
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
