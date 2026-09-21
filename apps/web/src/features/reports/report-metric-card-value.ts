/**
 * PharosGRC — maps one `ReportRunItem` (from `GET /reports/{reportId}/run`) onto
 * `@pharos/design-system`'s `MetricCard` value shape (009-indicators-reports, T061).
 *
 * This is the ONE place that decision is made for the Reports feature — mirrors
 * `features/indicators/metric-card-value.ts`'s own role for the Indicators feature, duplicated
 * rather than imported (CLAUDE.md §2, §4: business modules must not depend directly on each
 * other; see `metric-visuals.ts`'s own header for the same trade-off). Performs NO calculation of
 * its own — every number here is read straight from the server's response, never re-derived
 * (CLAUDE.md §19.7, one calculator: `IndicatorCalculationService`/`RunReportUseCase`).
 *
 * ## `available: false` is never a zero
 *
 * FR-026/SC-006: when the caller lacks a metric's own source read permission, `RunReportUseCase`
 * returns that ONE item with `available: false` and no `value`/`valueByBucket` — the rest of the
 * run still renders normally. This function turns that flag into `MetricCard`'s own distinct
 * `unavailable` state (muted dashed card, eye-off glyph, explanatory text) — never a bare `0`,
 * which would misreport "the caller cannot see this" as "computed and empty" (CLAUDE.md §18.11).
 */
import { indicators } from '@/lib/messages/indicators';
import { reports } from '@/lib/messages/reports';

import { BUCKET_LEVEL_ORDER } from './metric-visuals';

import type { IndicatorMetricKey, ReportRunItem } from './types';
import type { MetricCardValue } from '@pharos/design-system/components';

/** `COMPLIANCE_PERCENTAGE` is the only key whose single value is a percentage rather than a raw count (mirrors `features/indicators/metric-card-value.ts`'s own `formatSingleValue`, duplicated per this file's own header). */
function formatSingleValue(
  metricKey: IndicatorMetricKey,
  value: number,
): { value: string; unit?: string } {
  if (metricKey === 'COMPLIANCE_PERCENTAGE') {
    return { value: value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), unit: '%' };
  }
  return { value: value.toLocaleString('pt-BR') };
}

/** Builds the `MetricCard` value for one `ReportRunItem` — `available: false` first (FR-026), then `byBucket` (presence of `valueByBucket`) or `single`. */
export function buildReportItemMetricCardValue(item: ReportRunItem): MetricCardValue {
  if (!item.available) {
    return {
      status: 'unavailable',
      unavailableLabel: reports.run.itemUnavailable.label,
      unavailableHint: reports.run.itemUnavailable.hint,
    };
  }

  if (item.valueByBucket) {
    const source = item.valueByBucket;
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

  if (typeof item.value !== 'number') {
    return {
      status: 'unavailable',
      unavailableLabel: indicators.register.noDataYet.label,
      unavailableHint: indicators.register.noDataYet.hint,
    };
  }

  return {
    status: 'available',
    shape: 'single',
    ...formatSingleValue(item.metricKey, item.value),
  };
}
