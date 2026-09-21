/**
 * PharosGRC — reading one figure out of `GET /dashboard/summary`.
 *
 * The response is a flat list of whatever metrics the caller may read, so
 * "does this capability appear on the dashboard at all" and "what is its
 * number" are the same question: a key that is absent was omitted by the
 * server because the caller lacks the source domain's read permission, and
 * the screen must render nothing for it — not a zero, not a placeholder.
 *
 * Everything here is a lookup. No figure on the dashboard is derived in the
 * browser, with one deliberate exception noted on `bucketTotal` below.
 */
import type { DashboardSummaryMetric, DashboardSummaryResponse } from './types';

export type SummaryIndex = ReadonlyMap<string, DashboardSummaryMetric>;

export function indexSummary(summary: DashboardSummaryResponse | null): SummaryIndex {
  return new Map((summary?.metrics ?? []).map((metric) => [metric.metricKey, metric]));
}

/** `true` when the caller may read this metric's source domain at all. */
export function hasMetric(index: SummaryIndex, metricKey: string): boolean {
  return index.has(metricKey);
}

/**
 * A `SINGLE_VALUE` metric's number, or `undefined` when the source has no
 * data yet — the same `undefined` the server sent, never coerced to `0`.
 */
export function singleValue(index: SummaryIndex, metricKey: string): number | undefined {
  return index.get(metricKey)?.value;
}

/** One bucket of a `BY_BUCKET` metric (e.g. `CRITICAL` severity). */
export function bucketValue(
  index: SummaryIndex,
  metricKey: string,
  bucket: string,
): number | undefined {
  return index.get(metricKey)?.valueByBucket?.[bucket];
}

/**
 * The sum of a `BY_BUCKET` metric's buckets.
 *
 * The one arithmetic on this screen, and it is deliberate: the platform
 * publishes "open incidents BY SEVERITY" and has no separate "open
 * incidents" metric, so the total either comes from adding the buckets the
 * server already sent, or the dashboard cannot show a total at all. Adding
 * four numbers that arrived in one response is not the "frontend counts a
 * list" failure the brief rules out — nothing extra is fetched, no record is
 * read, and the sum cannot disagree with its own parts.
 *
 * Returns `undefined` — not `0` — when the metric is absent entirely, so an
 * omitted capability stays omitted rather than appearing with a zero.
 */
export function bucketTotal(index: SummaryIndex, metricKey: string): number | undefined {
  const buckets = index.get(metricKey)?.valueByBucket;
  if (!buckets) {
    return undefined;
  }
  return Object.values(buckets).reduce((total, count) => total + count, 0);
}

/**
 * Adds the named keys of one status map that arrived in a single response
 * ("em aberto" = `OPEN` + `IN_PROGRESS`; "pendentes" = `OPEN` + `IN_ANALYSIS`).
 * Same reasoning as `bucketTotal`: nothing extra is fetched and the sum cannot
 * disagree with its parts. `undefined` when the map itself is absent, so a
 * block the server omitted stays omitted instead of turning into a zero.
 */
export function sumOf<K extends string>(
  counts: Readonly<Record<K, number>> | undefined,
  keys: readonly K[],
): number | undefined {
  if (!counts) {
    return undefined;
  }
  return keys.reduce((total, key) => total + counts[key], 0);
}
