/**
 * `GET /dashboard/summary`'s `breakdowns.indicators` — the boundary port
 * between `modules/dashboard` and `modules/indicators`. `Indicator` is a
 * business-module domain (ADR-016), so this is a module-to-module
 * boundary — the same reasoning `compliance-summary.port.ts`/
 * `control-metrics.port.ts` document in full, applied here to a NEW
 * consumer (`modules/dashboard`) rather than `modules/indicators` itself
 * (which owns `IndicatorDefinition`/`IndicatorMeasurement` and has no need
 * of a boundary port to reach its own tables).
 *
 * This is deliberately a SEPARATE port from `IndicatorCalculationPort`
 * (`indicator-calculation.port.ts`), which `modules/dashboard` already
 * depends on for `metrics`: that port answers "what is the CURRENT VALUE
 * of catalog key K", one of the eleven `IndicatorMetricKey`s. This port
 * answers a different question entirely — "how many `IndicatorDefinition`s
 * exist and are active, and how many of THOSE are currently breached" —
 * which has no `IndicatorMetricKey` of its own and is never part of the
 * closed eleven-key catalog (`breakdowns` is intentionally NOT another
 * `IndicatorMetricKey`, CLAUDE.md §19.7's "não duplicar a regra" cuts the
 * other way here: introducing a twelfth catalog key for a value that is
 * about the catalog itself, not a source domain, would be the wrong kind
 * of reuse).
 */
export interface IndicatorMonitoringSummary {
  /** Count of `IndicatorDefinition` rows with `isActive = true`. */
  readonly monitored: number;
  /** Of the active definitions above, how many have their MOST RECENT
   * `IndicatorMeasurement` (by `metricKey`, greatest `computedAt`) with
   * `breached = true`. A definition with no measurement yet does not
   * count as breached — `breached` is never inferred, only read from the
   * stored, already-computed column (data-model.md §2 of
   * `009-indicators-reports`: `breached` is fixed at measurement-creation
   * time, never recalculated here). */
  readonly breached: number;
}

export abstract class IndicatorMonitoringPort {
  abstract getMonitoringSummary(): Promise<IndicatorMonitoringSummary>;
}
