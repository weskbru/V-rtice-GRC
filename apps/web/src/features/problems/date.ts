/**
 * PharosGRC — date-only helpers for the Problem Management feature
 * (008-incidents-problems, US2). A small, self-contained copy of
 * `features/assets/date.ts`'s own convention — deliberately NOT imported
 * from that module or any other (CLAUDE.md §2, §4: business modules must
 * not depend directly on each other).
 */

/** Formats a `date`-only field (`identifiedOn`) as a local calendar date, without any time-zone shift risk from parsing a bare `YYYY-MM-DD` as UTC midnight. */
export function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}

/** Formats a `date-time` field (`createdAt`, `updatedAt`, `resolvedAt`, `closedAt`, ...) as a local calendar date. */
export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

/** A `date-time` rendered to the minute — for a denser treatment than `formatTimestampDate`. */
export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}

/** Today's LOCAL calendar date as `YYYY-MM-DD` — never `Date#toISOString()`'s
 * UTC date, which returns TOMORROW in any timezone behind UTC during the
 * evening (found on the rendered screen, `finding-create-dialog.tsx`'s own
 * identical fix). Same convention every other module's `date.ts` repeats. */
export function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
