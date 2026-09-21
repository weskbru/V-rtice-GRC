import { describe, expect, it } from 'vitest';

import { formatDateOnly, parseDateOnly, todayDateOnly } from './date';

/**
 * Regression test for a real off-by-one bug caught during T096/T097
 * screenshot verification: `new Date('2026-01-02')` parses a date-only
 * string as UTC midnight, which renders as 01/01/2026 in any timezone
 * behind UTC. `Risk.identifiedOn`/`nextReviewOn`/`lastAssessedOn` are
 * `date`, not `date-time` (data-model.md §8), so they must always be
 * interpreted as a local calendar date.
 */
describe('formatDateOnly / parseDateOnly', () => {
  it('formats a date-only string as the same calendar day regardless of the local timezone', () => {
    const parsed = parseDateOnly('2026-01-02');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(0);
    expect(parsed.getDate()).toBe(2);
    expect(formatDateOnly('2026-01-02')).toBe('02/01/2026');
  });

  it('never shifts to the previous day, the classic UTC-midnight pitfall', () => {
    expect(formatDateOnly('2026-01-01')).toBe('01/01/2026');
    expect(formatDateOnly('2026-12-31')).toBe('31/12/2026');
  });
});

describe('todayDateOnly', () => {
  it('returns a YYYY-MM-DD string matching the local calendar date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`;
    expect(todayDateOnly()).toBe(expected);
  });
});
