/**
 * PharosGRC — date-only helpers for the Asset Management feature (T046,
 * 006-assets-processes).
 *
 * A small, self-contained copy of `features/audit-engagements/date.ts`'s
 * own convention — deliberately NOT imported from that module or from
 * `features/controls`/`features/risks` (CLAUDE.md §2, §4: business modules
 * must not depend directly on each other).
 *
 * Narrower than that module's `date.ts`: `AssetSummary`/`AssetDetail`
 * (`../types.ts`) carry only `date-time` fields (`createdAt`, `updatedAt`)
 * — no `date`-only field exists anywhere in this contract — so this file
 * exports only `formatTimestampDate`/`formatTimestamp`. Every date this
 * module renders goes through one of these, never a bare
 * `new Date(...).toLocaleDateString()` at a call site (see
 * `date-call-sites.test.ts` in this same directory, which enforces exactly
 * that).
 */

/** Formats a `date-time` field (`createdAt`, `updatedAt`, ...) as a local calendar date. */
export function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

/**
 * A `date-time` rendered to the minute — for a denser treatment than
 * `formatTimestampDate`. Explicit options, not a bare `toLocaleString('pt-
 * BR')`: pt-BR's own default includes seconds, which this function's own
 * name promises NOT to show — seconds are noise in a context no one reads
 * to the second (mirrors `RiskRelationshipsAside`'s/`ControlContextAside`'s
 * own local `formatUpdatedAt`, promoted here to this module's own shared
 * `date.ts` so `022-asset-detail-experience`'s aside — this function's
 * first real caller — goes through it instead of a THIRD independently
 * written copy, which `date-call-sites.test.ts` would have refused anyway).
 */
export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
