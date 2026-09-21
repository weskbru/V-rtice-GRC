/**
 * 009-indicators-reports, Fase 3 (T019-T028, data-model.md §3, research.md
 * D-4). The two provider shapes `IndicatorCalculationService` (T029)
 * dispatches to — one per `IndicatorMetricCatalogEntry.scopeApplicability`
 * (`indicator-metric-catalog.ts`).
 *
 * ## Why two interfaces, not one with an optional `scope`
 *
 * An optional parameter is exactly the shape that lets a caller forget to
 * pass it and silently get "no restriction" instead of "not applicable" —
 * the same failure mode `shared/persistence/scope-filter.ts`'s own header
 * warns against for `ScopeFilter` itself. Splitting into two interfaces
 * makes "this metric's source has no organizational-unit column"
 * (research.md D-8 — `COMPLIANCE_PERCENTAGE` only) a COMPILE-TIME fact: the
 * one provider that implements `OrganizationWideIndicatorMetricProvider`
 * has a `computeValue()` with NO parameter at all, not a `ScopeFilter` its
 * body chooses to ignore. `indicator-calculation-service.spec.ts`
 * (Fase 3's own test) proves this at runtime too, by checking the
 * function's arity (`computeValue.length === 0`) — a provider that
 * accepted an ignored `ScopeFilter` parameter would fail that assertion
 * even though it "works".
 *
 * ## Every provider computes ONE metric key, never dispatches internally
 *
 * Mirrors `IndicatorMetricCatalogEntry` itself being one entry per key
 * (data-model.md §3): a provider that branched on `metricKey` internally
 * would reintroduce exactly the free-form dispatch research.md D-4
 * rejects ("nunca uma consulta livre parametrizável"). `IndicatorCalculationService`
 * is the ONLY place that maps a key to a provider (CLAUDE.md §19.7) — see
 * that file's own header for how registration is structured so a provider
 * is unreachable except through it.
 */
import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { IndicatorMetricKey } from '@prisma/client';

/** The raw computed value of one metric, before threshold evaluation or
 * catalog metadata (`scopeApplicability`, `shape`) are attached —
 * `IndicatorCalculationService`'s own job. Invariant M1 (data-model.md
 * §2) is enforced by the DISCRIMINATED UNION itself: a caller can never
 * construct a value with both `value` and `valueByBucket`, or neither. */
export type IndicatorMetricValue =
  | { readonly shape: 'SINGLE_VALUE'; readonly value: number | undefined }
  | { readonly shape: 'BY_BUCKET'; readonly valueByBucket: Readonly<Record<string, number>> };

/**
 * The ten `IndicatorMetricKey` values whose source has its own
 * organizational-unit column (`scopeApplicability: 'ORGANIZATIONAL_UNIT'`,
 * data-model.md §3). `computeValue` takes the caller's resolved
 * `ScopeFilter` as a REQUIRED parameter — never optional, never defaulted
 * — mirroring `DashboardQueryPort`'s own guarantee that no method here can
 * be called without one.
 */
export interface ScopedIndicatorMetricProvider {
  readonly metricKey: IndicatorMetricKey;
  computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue>;
}

/**
 * The ONE `IndicatorMetricKey` whose source has no organizational-unit
 * column at all (`COMPLIANCE_PERCENTAGE`, research.md D-8).
 * `computeValue` takes NO parameter — see this file's header for why that
 * is a deliberate, testable compile-time fact rather than an ignored
 * argument.
 */
export interface OrganizationWideIndicatorMetricProvider {
  readonly metricKey: IndicatorMetricKey;
  computeValue(): Promise<IndicatorMetricValue>;
}
