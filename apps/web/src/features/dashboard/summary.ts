import type { DashboardSummaryMetric, DashboardSummaryResponse } from './types';

export type SummaryIndex = ReadonlyMap<string, DashboardSummaryMetric>;

export function indexSummary(summary: DashboardSummaryResponse | null): SummaryIndex {
  return new Map((summary?.metrics ?? []).map((metric) => [metric.metricKey, metric]));
}

export function hasMetric(index: SummaryIndex, metricKey: string): boolean {
  return index.has(metricKey);
}

export function singleValue(index: SummaryIndex, metricKey: string): number | undefined {
  return index.get(metricKey)?.value;
}

export function bucketValue(
  index: SummaryIndex,
  metricKey: string,
  bucket: string,
): number | undefined {
  return index.get(metricKey)?.valueByBucket?.[bucket];
}

export function bucketTotal(index: SummaryIndex, metricKey: string): number | undefined {
  const buckets = index.get(metricKey)?.valueByBucket;
  if (!buckets) {
    return undefined;
  }
  return Object.values(buckets).reduce((total, count) => total + count, 0);
}

export function sumOf<K extends string>(
  counts: Readonly<Record<K, number>> | undefined,
  keys: readonly K[],
): number | undefined {
  if (!counts) {
    return undefined;
  }
  return keys.reduce((total, key) => total + counts[key], 0);
}
