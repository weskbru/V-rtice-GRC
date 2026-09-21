/**
 * PharosGRC — date/time helpers for the Compliance feature.
 *
 * A small, self-contained copy of `features/controls/date.ts`'s own
 * `formatTimestampDate`/`formatTimestamp` — deliberately NOT imported from
 * `features/controls` or `features/risks` (CLAUDE.md §2, §4, §19: business
 * modules must not depend directly on each other).
 */

/** Formats a `date-time` field (e.g. `createdAt`, `updatedAt`, `publishedAt`) as a local calendar date. */
export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

/** A `date-time` rendered to the minute — for a detail line that wants the denser treatment. */
export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}
