/**
 * PharosGRC — date-only helpers for the Process Management feature (T046,
 * 006-assets-processes).
 *
 * A small, self-contained copy of `features/assets/date.ts` (FR-020: the
 * two contracts are "identical in form") — deliberately NOT imported from
 * that module or from `features/controls`/`features/risks` (CLAUDE.md §2,
 * §4: business modules must not depend directly on each other).
 *
 * `ProcessSummary`/`ProcessDetail` (`../types.ts`) carry only `date-time`
 * fields (`createdAt`, `updatedAt`) — no `date`-only field exists anywhere
 * in this contract — so this file exports only
 * `formatTimestampDate`/`formatTimestamp`. Every date this module renders
 * goes through one of these, never a bare
 * `new Date(...).toLocaleDateString()` at a call site (see
 * `date-call-sites.test.ts` in this same directory, which enforces exactly
 * that).
 */

/** Formats a `date-time` field (`createdAt`, `updatedAt`, ...) as a local calendar date. */
export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

/** A `date-time` rendered to the minute — for a denser treatment than `formatTimestampDate`. */
export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}
