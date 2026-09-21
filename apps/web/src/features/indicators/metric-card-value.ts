/**
 * PharosGRC — maps a `GET /indicators/{metricKey}/current` response (or a
 * known failure to obtain one) onto `@pharos/design-system`'s `MetricCard`
 * value shape (T060, 009-indicators-reports).
 *
 * This is the ONE place that decision is made — both `IndicatorMetricCard`
 * (catalog grid) and the indicator detail page's own summary card call
 * this, rather than each re-deriving the `SINGLE_VALUE`/`BY_BUCKET`/
 * "no data yet" branching independently (CLAUDE.md §13.8, avoid
 * duplication). It performs NO calculation of its own — every number here
 * is read straight from the server's response, never re-derived
 * (CLAUDE.md §19.7, one calculator: `IndicatorCalculationService`).
 */
import { indicators } from '@/lib/messages/indicators';

import { formatTimestamp } from './date';
import { BUCKET_LEVEL_ORDER, toRiskLevel } from './metric-visuals';

import type {
  IndicatorCurrentValue,
  IndicatorMetricKey,
  IndicatorScopeApplicability,
} from './types';
import type { MetricCardValue } from '@pharos/design-system/components';

/** `COMPLIANCE_PERCENTAGE` is the only key whose single value is a percentage rather than a raw count (data-model.md §3) — formatted with a `%` unit and one decimal place, every other `SINGLE_VALUE` key as a plain integer. */
function formatSingleValue(
  metricKey: IndicatorMetricKey,
  value: number,
): { value: string; unit?: string } {
  if (metricKey === 'COMPLIANCE_PERCENTAGE') {
    return { value: value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), unit: '%' };
  }
  return { value: value.toLocaleString('pt-BR') };
}

/**
 * Builds the `available`/`unavailable` value for a successfully-fetched
 * `IndicatorCurrentValue`. `shape === 'SINGLE_VALUE'` with `value === null`
 * is its own `unavailable` reason ("no data yet" — `IndicatorCalculationService`'s
 * documented edge case for `COMPLIANCE_PERCENTAGE`), never rendered as `0`.
 */
export function buildAvailableMetricCardValue(current: IndicatorCurrentValue): MetricCardValue {
  if (current.shape === 'BY_BUCKET') {
    const source = current.valueByBucket ?? {};
    const buckets = BUCKET_LEVEL_ORDER.flatMap((level) => {
      const count = source[level];
      return count === undefined ? [] : [{ level, count }];
    });
    return {
      status: 'available',
      shape: 'byBucket',
      buckets,
      badgeLabels: indicators.bucketBadgeLabels,
    };
  }

  if (typeof current.value !== 'number') {
    return {
      status: 'unavailable',
      unavailableLabel: indicators.register.noDataYet.label,
      unavailableHint: indicators.register.noDataYet.hint,
    };
  }

  return {
    status: 'available',
    shape: 'single',
    ...formatSingleValue(current.metricKey, current.value),
  };
}

/** `unavailable` value for a metric this caller could not fetch at all — either the source domain's own permission is missing (FR-006's second gate) or a genuine load failure (network/5xx). Never a bare zero (CLAUDE.md §18.11). */
export function buildUnavailableMetricCardValue(
  reason: 'sourcePermission' | 'loadFailed',
): MetricCardValue {
  const copy =
    reason === 'sourcePermission'
      ? indicators.register.sourcePermissionMissing
      : indicators.register.loadFailed;
  return { status: 'unavailable', unavailableLabel: copy.label, unavailableHint: copy.hint };
}

/**
 * `MetricCard.orgUnitLabel` — takes the metric's OWN `scopeApplicability` (S-07, `A4-F01`), never
 * only the caller's `EffectiveScope.global`: an `ORGANIZATION_WIDE` metric (`COMPLIANCE_PERCENTAGE`
 * today) is computed for the whole organization no matter who asks, so it must read "Organização
 * inteira" even for a `UNIT`-scoped caller. See `indicators.register.scopeLabel`'s own doc comment.
 */
export function metricScopeLabel(
  scopeApplicability: IndicatorScopeApplicability,
  callerScopeIsGlobal: boolean,
): string {
  return indicators.register.scopeLabel(scopeApplicability, callerScopeIsGlobal);
}

/** `MetricCard.updatedAtLabel`. */
export function metricUpdatedAtLabel(computedAtIso: string): string {
  return indicators.register.updatedAtLabel(formatTimestamp(computedAtIso));
}

/** `RiskLevel` bucket levels present in a `valueByBucket` map, in fixed display order — used by the history table's compact per-row summary (a `TrendChart` series list is built the same way, independently, since its series need colors too). */
export function orderedBucketEntries(
  valueByBucket: Readonly<Record<string, number>> | null | undefined,
): readonly { level: (typeof BUCKET_LEVEL_ORDER)[number]; count: number }[] {
  if (!valueByBucket) return [];
  return BUCKET_LEVEL_ORDER.flatMap((level) => {
    const count = valueByBucket[level];
    return count === undefined ? [] : [{ level, count }];
  });
}

/** Re-exported for callers that only have a raw bucket key string (e.g. iterating `Object.keys`) and need the same closed-union cast `metric-visuals.ts` provides. */
export { toRiskLevel };
