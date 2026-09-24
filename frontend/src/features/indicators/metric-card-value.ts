import { indicators } from '@/lib/messages/indicators';

import { formatTimestamp } from './date';
import { BUCKET_LEVEL_ORDER, toRiskLevel } from './metric-visuals';

import type {
  IndicatorCurrentValue,
  IndicatorMetricKey,
  IndicatorScopeApplicability,
} from './types';
import type { MetricCardValue } from '@pharos/design-system/components';

function formatSingleValue(
  metricKey: IndicatorMetricKey,
  value: number,
): { value: string; unit?: string } {
  if (metricKey === 'COMPLIANCE_PERCENTAGE') {
    return { value: value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), unit: '%' };
  }
  return { value: value.toLocaleString('pt-BR') };
}

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

export function buildUnavailableMetricCardValue(
  reason: 'sourcePermission' | 'loadFailed',
): MetricCardValue {
  const copy =
    reason === 'sourcePermission'
      ? indicators.register.sourcePermissionMissing
      : indicators.register.loadFailed;
  return { status: 'unavailable', unavailableLabel: copy.label, unavailableHint: copy.hint };
}

export function metricScopeLabel(
  scopeApplicability: IndicatorScopeApplicability,
  callerScopeIsGlobal: boolean,
): string {
  return indicators.register.scopeLabel(scopeApplicability, callerScopeIsGlobal);
}

export function metricUpdatedAtLabel(computedAtIso: string): string {
  return indicators.register.updatedAtLabel(formatTimestamp(computedAtIso));
}

export function orderedBucketEntries(
  valueByBucket: Readonly<Record<string, number>> | null | undefined,
): readonly { level: (typeof BUCKET_LEVEL_ORDER)[number]; count: number }[] {
  if (!valueByBucket) return [];
  return BUCKET_LEVEL_ORDER.flatMap((level) => {
    const count = valueByBucket[level];
    return count === undefined ? [] : [{ level, count }];
  });
}

export { toRiskLevel };
