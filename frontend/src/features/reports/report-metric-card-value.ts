import { indicators } from '@/lib/messages/indicators';
import { reports } from '@/lib/messages/reports';

import { BUCKET_LEVEL_ORDER } from './metric-visuals';

import type { IndicatorMetricKey, ReportRunItem } from './types';
import type { MetricCardValue } from '@vertice/design-system/components';

function formatSingleValue(
  metricKey: IndicatorMetricKey,
  value: number,
): { value: string; unit?: string } {
  if (metricKey === 'COMPLIANCE_PERCENTAGE') {
    return { value: value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), unit: '%' };
  }
  return { value: value.toLocaleString('pt-BR') };
}

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
