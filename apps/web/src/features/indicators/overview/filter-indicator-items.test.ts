import { describe, expect, it } from 'vitest';

import {
  buildIndicatorDomainCounts,
  filterIndicatorOverviewItems,
  sortByIndicatorDomainOrder,
} from './filter-indicator-items';

import type { IndicatorOverviewItem } from './indicator-overview-model';
import type { IndicatorMetricKey } from '../types';

function item(
  metricKey: IndicatorMetricKey,
  domain: IndicatorOverviewItem['domain'],
): IndicatorOverviewItem {
  return {
    metricKey,
    domain,
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    reading: { kind: 'no-data' },
    detailHref: `/indicators/${metricKey}`,
  };
}

const ITEMS: readonly IndicatorOverviewItem[] = [
  item('RISK_TOTAL_BY_LEVEL', 'RISK'),
  item('RISK_TREATMENT_OVERDUE_COUNT', 'RISK'),
  item('CONTROL_INACTIVE_COUNT', 'CONTROL'),
  item('COMPLIANCE_PERCENTAGE', 'COMPLIANCE'),
  item('AUDIT_ENGAGEMENT_OPEN_COUNT', 'AUDIT'),
  item('FINDING_OPEN_COUNT_BY_SEVERITY', 'FINDING'),
  item('ASSET_INACTIVE_COUNT', 'ASSET'),
  item('PROCESS_INACTIVE_COUNT', 'PROCESS'),
  item('ACTION_OVERDUE_COUNT', 'ACTION'),
  item('INCIDENT_OPEN_COUNT_BY_SEVERITY', 'INCIDENT'),
  item('PROBLEM_OPEN_COUNT_BY_SEVERITY', 'PROBLEM'),
];

describe('filterIndicatorOverviewItems', () => {
  it('returns every item when there is no query and domain is ALL', () => {
    expect(filterIndicatorOverviewItems(ITEMS, { query: '', domain: 'ALL' })).toHaveLength(11);
  });

  it('narrows to one domain', () => {
    const result = filterIndicatorOverviewItems(ITEMS, { query: '', domain: 'RISK' });
    expect(result.map((i) => i.metricKey)).toEqual([
      'RISK_TOTAL_BY_LEVEL',
      'RISK_TREATMENT_OVERDUE_COUNT',
    ]);
  });

  it("matches the metric's own pt-BR name, case- and accent-insensitively", () => {
    const result = filterIndicatorOverviewItems(ITEMS, { query: 'nível', domain: 'ALL' });
    expect(result.map((i) => i.metricKey)).toEqual(['RISK_TOTAL_BY_LEVEL']);

    const upper = filterIndicatorOverviewItems(ITEMS, { query: 'CONTROLES', domain: 'ALL' });
    expect(upper.map((i) => i.metricKey)).toEqual(['CONTROL_INACTIVE_COUNT']);
  });

  it('trims surrounding whitespace from the query', () => {
    const result = filterIndicatorOverviewItems(ITEMS, {
      query: '  ativos inativos  ',
      domain: 'ALL',
    });
    expect(result.map((i) => i.metricKey)).toEqual(['ASSET_INACTIVE_COUNT']);
  });

  it('combines a domain filter with a search query', () => {
    const result = filterIndicatorOverviewItems(ITEMS, { query: 'atraso', domain: 'RISK' });
    expect(result.map((i) => i.metricKey)).toEqual(['RISK_TREATMENT_OVERDUE_COUNT']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterIndicatorOverviewItems(ITEMS, { query: 'inexistente', domain: 'ALL' })).toEqual(
      [],
    );
  });
});

describe('buildIndicatorDomainCounts', () => {
  it('counts every present domain, in sidebar order (not catalog/first-seen order)', () => {
    expect(buildIndicatorDomainCounts(ITEMS)).toEqual([
      { value: 'RISK', count: 2 },
      { value: 'ACTION', count: 1 },
      { value: 'PROBLEM', count: 1 },
      { value: 'INCIDENT', count: 1 },
      { value: 'CONTROL', count: 1 },
      { value: 'ASSET', count: 1 },
      { value: 'PROCESS', count: 1 },
      { value: 'COMPLIANCE', count: 1 },
      { value: 'AUDIT', count: 1 },
      { value: 'FINDING', count: 1 },
    ]);
  });

  it('returns an empty array for an empty item list', () => {
    expect(buildIndicatorDomainCounts([])).toEqual([]);
  });
});

describe('sortByIndicatorDomainOrder', () => {
  it('sorts items into sidebar order regardless of their input order', () => {
    const shuffled = [
      item('PROBLEM_OPEN_COUNT_BY_SEVERITY', 'PROBLEM'),
      item('FINDING_OPEN_COUNT_BY_SEVERITY', 'FINDING'),
      item('RISK_TOTAL_BY_LEVEL', 'RISK'),
      item('INCIDENT_OPEN_COUNT_BY_SEVERITY', 'INCIDENT'),
    ];

    expect(sortByIndicatorDomainOrder(shuffled).map((i) => i.domain)).toEqual([
      'RISK',
      'PROBLEM',
      'INCIDENT',
      'FINDING',
    ]);
  });

  it('does not mutate the input array', () => {
    const original = [
      item('PROBLEM_OPEN_COUNT_BY_SEVERITY', 'PROBLEM'),
      item('RISK_TOTAL_BY_LEVEL', 'RISK'),
    ];
    const copy = [...original];
    sortByIndicatorDomainOrder(original);
    expect(original).toEqual(copy);
  });
});
