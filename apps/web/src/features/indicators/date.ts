/**
 * PharosGRC — date-time helper for the Indicators feature (T060,
 * 009-indicators-reports).
 *
 * A small, self-contained copy of `features/assets/date.ts`'s own
 * convention — deliberately NOT imported from that module or from any
 * other business module (CLAUDE.md §2, §4: business modules must not
 * depend directly on each other). Every `date-time` field this feature
 * renders (`IndicatorCurrentValue.computedAt`, `IndicatorMeasurement
 * .computedAt`) goes through this one function, never a bare
 * `new Date(...).toLocaleString()` at a call site.
 */

/** A `date-time` field rendered to the minute, e.g. "12/09/2026 14:32". */
export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}
