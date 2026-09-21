/**
 * PharosGRC — date-only (`YYYY-MM-DD`) and timestamp helpers for the
 * Findings feature (T077/T078, 005-audit-findings).
 *
 * A small, self-contained copy of `features/controls/date.ts`'s own
 * `formatDateOnly`/`formatTimestampDate` — deliberately NOT imported from
 * `features/controls` or `features/risks` (CLAUDE.md §2, §4: business
 * modules must not depend directly on each other). Only the two helpers
 * this feature's new components actually call are reproduced here; see
 * `features/controls/date.ts`'s own doc comment for the off-by-one a bare
 * `new Date(...).toLocaleDateString()` would introduce on a `date`-only
 * field.
 */

/** Parses a `date`-only string as a local calendar date. */
function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** Formats a `date`-only field (e.g. `Finding.identifiedOn`). */
export function formatDateOnly(value: string): string {
  return parseDateOnly(value).toLocaleDateString('pt-BR');
}

/** Formats a `date-time` field (e.g. `linkedAt`, `unlinkedAt`) as a local calendar date. */
export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}
