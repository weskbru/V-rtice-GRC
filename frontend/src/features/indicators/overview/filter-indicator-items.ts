import { indicators } from '@/lib/messages/indicators';

import type { IndicatorDomain, IndicatorOverviewItem } from './indicator-overview-model';

export type IndicatorDomainFilterValue = IndicatorDomain | 'ALL';

export const INDICATOR_DOMAIN_ORDER: readonly IndicatorDomain[] = [
  'RISK',
  'ACTION',
  'PROBLEM',
  'INCIDENT',
  'CONTROL',
  'ASSET',
  'PROCESS',
  'COMPLIANCE',
  'AUDIT',
  'FINDING',
];

export function sortByIndicatorDomainOrder<T extends { readonly domain: IndicatorDomain }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => INDICATOR_DOMAIN_ORDER.indexOf(a.domain) - INDICATOR_DOMAIN_ORDER.indexOf(b.domain),
  );
}

export interface IndicatorOverviewFilterState {
  readonly query: string;
  readonly domain: IndicatorDomainFilterValue;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

export function filterIndicatorOverviewItems(
  items: readonly IndicatorOverviewItem[],
  filter: IndicatorOverviewFilterState,
): readonly IndicatorOverviewItem[] {
  const query = normalize(filter.query);

  return items.filter((item) => {
    if (filter.domain !== 'ALL' && item.domain !== filter.domain) {
      return false;
    }
    if (query && !normalize(indicators.metricKeyLabels[item.metricKey]).includes(query)) {
      return false;
    }
    return true;
  });
}

export interface IndicatorDomainCount {
  readonly value: IndicatorDomain;
  readonly count: number;
}

export function buildIndicatorDomainCounts(
  items: readonly IndicatorOverviewItem[],
): readonly IndicatorDomainCount[] {
  const counts = new Map<IndicatorDomain, number>();
  for (const item of items) {
    counts.set(item.domain, (counts.get(item.domain) ?? 0) + 1);
  }
  return INDICATOR_DOMAIN_ORDER.flatMap((domain) => {
    const count = counts.get(domain);
    return count === undefined ? [] : [{ value: domain, count }];
  });
}
