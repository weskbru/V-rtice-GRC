/**
 * 009-indicators-reports, Fase 7 (T052) — the boundary port between
 * `modules/reports` and `modules/indicators`. `RunReportUseCase` needs
 * exactly two things from Indicators, both already owned there:
 *
 *   1. `getMetadata` — the source-domain read permission a given
 *      `IndicatorMetricKey` requires, and its `scopeApplicability`
 *      (`indicator-metric-catalog.ts`'s own static data, FR-026) — needed
 *      BEFORE anything is computed, so the caller's per-item authorization
 *      can be checked first, the same order `GetIndicatorCurrentValueUseCase`
 *      already establishes for a single key (that use case's own header).
 *      A plain catalog lookup, no I/O.
 *   2. `calculate` — the actual computed value for a key under a scope
 *      (FR-025), delegating to `IndicatorCalculationService`, the
 *      platform's single calculator (CLAUDE.md §19.7) — never a second
 *      implementation.
 *
 * This port exists only because both live under `modules/indicators/**`,
 * and a business module may not import another business module's domain/
 * application layer directly (`apps/api/eslint.config.mjs`'s module-
 * isolation policy) — the identical reason `risk-dashboard-metrics.port.ts`/
 * `control-metrics.port.ts` exist for their own owning modules.
 *
 * `reports.module.ts` binds this port with a `useFactory` provider built
 * from `IndicatorsModule`'s own exported `IndicatorCalculationService` plus
 * its read-only `INDICATOR_METRIC_CATALOG` data (imported, never
 * duplicated, and `modules/indicators/**` itself is never edited to wire
 * this) — see that file's own header for the wiring.
 *
 * `getMetadata` returns `sourcePermission` as a plain `string`, not the
 * richer `PermissionIdentifier` type `core/authorization/domain/permissions.ts`
 * declares — `shared/**` may not import from `core/**` at all (ADR-011,
 * `apps/api/eslint.config.mjs` rule 3), so this port cannot name that type.
 * `RunReportUseCase` (a `module-application` file, free to import
 * `core-domain` directly — "modules -> core is allowed") narrows the
 * result back to `PermissionIdentifier` at its own call site with a
 * one-line cast; see that file's own comment for why the cast is safe (the
 * value always originates from `INDICATOR_METRIC_CATALOG`, itself typed
 * `PermissionIdentifier`).
 */
import type { ScopeFilter } from '../persistence/scope-filter';
import type { IndicatorMetricKey } from '@prisma/client';

export type IndicatorMetricScopeApplicability = 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';
export type IndicatorMetricShape = 'SINGLE_VALUE' | 'BY_BUCKET';

export interface IndicatorMetricPortMetadata {
  /** See this file's own header for why this is `string`, not
   * `PermissionIdentifier`. */
  readonly sourcePermission: string;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
}

export interface IndicatorCalculationPortResult {
  readonly metricKey: IndicatorMetricKey;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly shape: IndicatorMetricShape;
  /** Populated only when `shape === 'SINGLE_VALUE'` — `undefined` there too
   * when the source has no data yet (mirrors
   * `IndicatorCalculationResult.value`'s own "nunca 0 nem 100" edge case). */
  readonly value: number | undefined;
  /** Populated only when `shape === 'BY_BUCKET'`. */
  readonly valueByBucket: Readonly<Record<string, number>> | undefined;
}

export abstract class IndicatorCalculationPort {
  /** Static catalog lookup, no I/O — safe to call before deciding whether
   * `calculate` below should run at all (FR-026). */
  abstract getMetadata(metricKey: IndicatorMetricKey): IndicatorMetricPortMetadata;

  /** Delegates to `IndicatorCalculationService.calculate` — never a second
   * calculation (FR-025, CLAUDE.md §19.7). `scope` is resolved by the
   * caller EXACTLY ONCE per report execution and forwarded here for every
   * item, mirroring FR-006's "resolve escopo uma vez" for a single
   * indicator. */
  abstract calculate(input: {
    readonly metricKey: IndicatorMetricKey;
    readonly scope: ScopeFilter;
  }): Promise<IndicatorCalculationPortResult>;
}
