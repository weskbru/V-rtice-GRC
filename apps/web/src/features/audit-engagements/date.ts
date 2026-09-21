/**
 * PharosGRC — date-only (`YYYY-MM-DD`) helpers for the Audit Engagements
 * feature (T076).
 *
 * A small, self-contained copy of `features/risks/date.ts`'s own
 * `parseDateOnly`/`formatDateOnly`/`formatTimestampDate`/`formatTimestamp`/
 * `todayDateOnly` — deliberately NOT imported from `features/risks` or
 * `features/controls` (CLAUDE.md §2, §4: business modules must not depend
 * directly on each other). Every date field this module renders
 * (`periodStart`, `periodEnd`, `createdAt`, `updatedAt`, `startedAt`,
 * `completedAt`, `cancelledAt`, `linkedAt`, ...) goes through one of these,
 * never a bare `new Date(...).toLocaleDateString()` at a call site — see
 * `features/risks/date.ts`'s own doc comment for the off-by-one this
 * avoids.
 */

/** Parses a `date`-only string (`periodStart`/`periodEnd`, never a `date-time`) as a local calendar date — `new Date('2026-01-02')` parses as UTC midnight, which renders as the previous day in any timezone behind UTC. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** Formats a `date`-only field (e.g. `AuditEngagement.periodStart`/`periodEnd`). */
export function formatDateOnly(value: string): string {
  return parseDateOnly(value).toLocaleDateString('pt-BR');
}

/** Formats a `date-time` field (e.g. `createdAt`, `linkedAt`) as a local calendar date. Not interchangeable with `formatDateOnly` — see the module doc comment. */
export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

/** A `date-time` rendered to the minute — for a table cell or history row that wants the denser treatment. */
export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}

/** Today as a local `YYYY-MM-DD` string — never `Date#toISOString()`'s UTC date. */
export function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
