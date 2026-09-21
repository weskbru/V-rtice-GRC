/**
 * PharosGRC — date-only (`YYYY-MM-DD`) helpers for the risk feature.
 *
 * Every date field on `Risk` (`identifiedOn`, `nextReviewOn`,
 * `lastAssessedOn`) is a `date`, not a `date-time` (data-model.md §8,
 * risks.openapi.yaml). `new Date('2026-01-02')` parses a date-only string as
 * UTC midnight per the ECMAScript spec; formatting that with
 * `toLocaleDateString()` in any timezone behind UTC then renders as the
 * *previous* calendar day — a real, user-visible off-by-one bug, not a
 * hypothetical one (caught during T096/T097 screenshot verification). These
 * helpers parse and format a date-only string as a local calendar date
 * instead, matching how an `<input type="date">` and a human reading
 * "identified on" actually interpret it.
 */

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function formatDateOnly(value: string): string {
  return parseDateOnly(value).toLocaleDateString('pt-BR');
}

/**
 * Formats a `date-time` (`updatedAt`, `createdAt`, `decidedAt`, `occurredAt`
 * — ISO 8601 with a time component) as a local calendar date.
 *
 * This exists because `formatDateOnly` above is NOT interchangeable with it,
 * and the difference is silent: `formatDateOnly` splits on `-`, so an ISO
 * timestamp's last segment parses as `Number('04T12:30:00.000Z')` → `NaN`,
 * and the field renders the literal text "Invalid Date". That is exactly
 * what shipped to the register's cards and what a rendered-screen capture
 * caught after the unit suite went green — the card's own fixture used a
 * date-only `updatedAt`, a value the API never sends.
 *
 * So: `formatDateOnly` for a `date` field, `formatTimestampDate` for a
 * `date-time` field shown as a day, `formatTimestamp` for one shown to the
 * minute. Never a bare `new Date(...).toLocaleDateString()` at a call site.
 */
export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

/** A `date-time` rendered to the minute — the denser treatment a table cell or an audit/history row wants. */
export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}

/** Today as a local `YYYY-MM-DD` string — never `Date#toISOString()`'s UTC date, which can be a day ahead of or behind local "today". */
export function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
