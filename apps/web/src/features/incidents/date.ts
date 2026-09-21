/**
 * PharosGRC — date helpers for the Incident Management feature
 * (008-incidents-problems). A self-contained copy of
 * `features/risks/date.ts`'s own convention — deliberately NOT imported
 * from that module or any other (CLAUDE.md §2, §4: business modules must
 * not depend directly on each other).
 *
 * `reportedOn` is a `date` (`incidents.openapi.yaml`), not a `date-time` —
 * `parseDateOnly`/`formatDateOnly` exist specifically to avoid the
 * off-by-one rendering bug `features/risks/date.ts`'s own header records
 * paying for (`new Date('2026-01-02')` parses as UTC midnight; formatting
 * that in a timezone behind UTC renders the previous calendar day).
 * `resolvedAt`/`closedAt`/`createdAt`/`updatedAt` are `date-time` fields —
 * `formatTimestampDate`/`formatTimestamp` instead. Never a bare
 * `new Date(...).toLocaleDateString()` at a call site.
 */

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function formatDateOnly(value: string): string {
  return parseDateOnly(value).toLocaleDateString('pt-BR');
}

/** Formats a `date-time` field as a local calendar date. */
export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

/** A `date-time` rendered to the minute. */
export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}
