import { describe, expect, it } from 'vitest';

import { INDICATOR_METRIC_ICON } from '../metric-visuals';

import {
  INDICATOR_METRIC_KEY_ORDER,
  INDICATOR_NAVIGATION_TABLE,
  buildIndicatorMonitoring,
  buildIndicatorOverviewData,
  buildIndicatorOverviewItems,
  indicatorDomain,
  resolveIndicatorNavigation,
} from './indicator-overview-model';

import type { IndicatorDefinition, IndicatorMetricKey } from '../types';
import type { IndicatorNavigationEntry } from './indicator-overview-model';
import type { DashboardSummaryMetric } from '@/features/dashboard/types';

function buildDefinition(overrides: Partial<IndicatorDefinition> = {}): IndicatorDefinition {
  return {
    id: 'def-1',
    code: 'IND-2026-0001',
    metricKey: 'CONTROL_INACTIVE_COUNT',
    name: 'Controles inativos',
    description: 'Descrição de teste',
    owner: { id: 'user-1', fullName: 'Ada Owner' },
    thresholdComparator: null,
    thresholdValue: null,
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const ALWAYS_TRUE = (): boolean => true;
const ALWAYS_FALSE = (): boolean => false;

describe('INDICATOR_METRIC_KEY_ORDER', () => {
  it('covers exactly the 11 keys of the closed IndicatorMetricKey union, same set as INDICATOR_METRIC_ICON', () => {
    const iconKeys = Object.keys(INDICATOR_METRIC_ICON).sort();
    const catalogKeys = [...INDICATOR_METRIC_KEY_ORDER].sort();
    expect(catalogKeys).toHaveLength(11);
    expect(catalogKeys).toEqual(iconKeys);
  });
});

describe('indicatorDomain', () => {
  it.each<[IndicatorMetricKey, string]>([
    ['RISK_TOTAL_BY_LEVEL', 'RISK'],
    ['RISK_TREATMENT_OVERDUE_COUNT', 'RISK'],
    ['CONTROL_INACTIVE_COUNT', 'CONTROL'],
    ['COMPLIANCE_PERCENTAGE', 'COMPLIANCE'],
    ['AUDIT_ENGAGEMENT_OPEN_COUNT', 'AUDIT'],
    ['FINDING_OPEN_COUNT_BY_SEVERITY', 'FINDING'],
    ['ASSET_INACTIVE_COUNT', 'ASSET'],
    ['PROCESS_INACTIVE_COUNT', 'PROCESS'],
    ['ACTION_OVERDUE_COUNT', 'ACTION'],
    ['INCIDENT_OPEN_COUNT_BY_SEVERITY', 'INCIDENT'],
    ['PROBLEM_OPEN_COUNT_BY_SEVERITY', 'PROBLEM'],
  ])('maps %s to domain %s', (metricKey, domain) => {
    expect(indicatorDomain(metricKey)).toBe(domain);
  });
});

describe('buildIndicatorOverviewItems', () => {
  it('always returns all 11 catalog keys, in catalog order, even with empty inputs', () => {
    const items = buildIndicatorOverviewItems({
      metrics: [],
      definitions: [],
      hasPermission: ALWAYS_FALSE,
    });

    expect(items.map((item) => item.metricKey)).toEqual(INDICATOR_METRIC_KEY_ORDER);
    expect(items).toHaveLength(11);
  });

  it('marks a key omitted from the summary as no-permission, with static shape/scope fallback', () => {
    const [item] = buildIndicatorOverviewItems({
      metrics: [],
      definitions: [],
      hasPermission: ALWAYS_FALSE,
    });
    if (!item) throw new Error('expected at least one item');

    expect(item.metricKey).toBe('RISK_TOTAL_BY_LEVEL');
    expect(item.reading).toEqual({ kind: 'no-permission' });
    expect(item.shape).toBe('BY_BUCKET');
    expect(item.scopeApplicability).toBe('ORGANIZATIONAL_UNIT');
  });

  it('marks a SINGLE_VALUE key present with no value as no-data (never a fabricated zero)', () => {
    const metrics: DashboardSummaryMetric[] = [
      {
        metricKey: 'CONTROL_INACTIVE_COUNT',
        shape: 'SINGLE_VALUE',
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
      },
    ];
    const items = buildIndicatorOverviewItems({
      metrics,
      definitions: [],
      hasPermission: ALWAYS_FALSE,
    });
    const item = items.find((entry) => entry.metricKey === 'CONTROL_INACTIVE_COUNT');

    expect(item?.reading).toEqual({ kind: 'no-data' });
  });

  it('marks a BY_BUCKET key present with no valueByBucket as no-data', () => {
    const metrics: DashboardSummaryMetric[] = [
      {
        metricKey: 'RISK_TOTAL_BY_LEVEL',
        shape: 'BY_BUCKET',
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
      },
    ];
    const items = buildIndicatorOverviewItems({
      metrics,
      definitions: [],
      hasPermission: ALWAYS_FALSE,
    });
    const item = items.find((entry) => entry.metricKey === 'RISK_TOTAL_BY_LEVEL');

    expect(item?.reading).toEqual({ kind: 'no-data' });
  });

  it('keeps a real zero as a single 0 reading, never no-data', () => {
    const metrics: DashboardSummaryMetric[] = [
      {
        metricKey: 'ASSET_INACTIVE_COUNT',
        shape: 'SINGLE_VALUE',
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: 0,
      },
    ];
    const items = buildIndicatorOverviewItems({
      metrics,
      definitions: [],
      hasPermission: ALWAYS_FALSE,
    });
    const item = items.find((entry) => entry.metricKey === 'ASSET_INACTIVE_COUNT');

    expect(item?.reading).toEqual({ kind: 'single', value: 0, unit: 'count' });
  });

  it('sets unit "percent" only for COMPLIANCE_PERCENTAGE, "count" for every other SINGLE_VALUE key', () => {
    const metrics: DashboardSummaryMetric[] = [
      {
        metricKey: 'COMPLIANCE_PERCENTAGE',
        shape: 'SINGLE_VALUE',
        scopeApplicability: 'ORGANIZATION_WIDE',
        value: 42.5,
      },
      {
        metricKey: 'ACTION_OVERDUE_COUNT',
        shape: 'SINGLE_VALUE',
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: 7,
      },
    ];
    const items = buildIndicatorOverviewItems({
      metrics,
      definitions: [],
      hasPermission: ALWAYS_FALSE,
    });

    expect(items.find((i) => i.metricKey === 'COMPLIANCE_PERCENTAGE')?.reading).toEqual({
      kind: 'single',
      value: 42.5,
      unit: 'percent',
    });
    expect(items.find((i) => i.metricKey === 'ACTION_OVERDUE_COUNT')?.reading).toEqual({
      kind: 'single',
      value: 7,
      unit: 'count',
    });
  });

  it('orders buckets LOW→MEDIUM→HIGH→CRITICAL, zero-filling any bucket the server omitted, and totals them', () => {
    const metrics: DashboardSummaryMetric[] = [
      {
        metricKey: 'INCIDENT_OPEN_COUNT_BY_SEVERITY',
        shape: 'BY_BUCKET',
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        valueByBucket: { HIGH: 212, LOW: 3 },
      },
    ];
    const items = buildIndicatorOverviewItems({
      metrics,
      definitions: [],
      hasPermission: ALWAYS_FALSE,
    });
    const reading = items.find((i) => i.metricKey === 'INCIDENT_OPEN_COUNT_BY_SEVERITY')?.reading;

    expect(reading?.kind).toBe('buckets');
    if (reading?.kind !== 'buckets') throw new Error('expected buckets reading');
    expect(reading.buckets.map((b) => b.key)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    expect(reading.buckets.map((b) => b.count)).toEqual([3, 0, 212, 0]);
    expect(reading.total).toBe(215);
  });

  it('never computes anything about breach/threshold status on a reading', () => {
    const metrics: DashboardSummaryMetric[] = [
      {
        metricKey: 'ACTION_OVERDUE_COUNT',
        shape: 'SINGLE_VALUE',
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: 92,
      },
    ];
    const items = buildIndicatorOverviewItems({
      metrics,
      definitions: [],
      hasPermission: ALWAYS_FALSE,
    });
    const item = items.find((i) => i.metricKey === 'ACTION_OVERDUE_COUNT');

    expect(item?.reading).not.toHaveProperty('breached');
  });

  it('exposes a threshold only from an ACTIVE definition with both comparator and value', () => {
    const withThreshold = buildDefinition({
      metricKey: 'CONTROL_INACTIVE_COUNT',
      isActive: true,
      thresholdComparator: 'GTE',
      thresholdValue: 10,
    });
    const items = buildIndicatorOverviewItems({
      metrics: [],
      definitions: [withThreshold],
      hasPermission: ALWAYS_FALSE,
    });

    expect(items.find((i) => i.metricKey === 'CONTROL_INACTIVE_COUNT')?.threshold).toEqual({
      comparator: 'GTE',
      value: 10,
    });
  });

  it('omits threshold for an inactive definition, even with comparator+value set', () => {
    const inactive = buildDefinition({
      metricKey: 'CONTROL_INACTIVE_COUNT',
      isActive: false,
      thresholdComparator: 'GTE',
      thresholdValue: 10,
    });
    const items = buildIndicatorOverviewItems({
      metrics: [],
      definitions: [inactive],
      hasPermission: ALWAYS_FALSE,
    });

    const item = items.find((i) => i.metricKey === 'CONTROL_INACTIVE_COUNT');
    expect(item?.threshold).toBeUndefined();
    expect(item?.definition).toBeUndefined();
  });

  it('omits threshold when only one of comparator/value is set (Invariant T1 violation never trusted blindly)', () => {
    const partial = buildDefinition({
      metricKey: 'CONTROL_INACTIVE_COUNT',
      isActive: true,
      thresholdComparator: 'GTE',
      thresholdValue: null,
    });
    const items = buildIndicatorOverviewItems({
      metrics: [],
      definitions: [partial],
      hasPermission: ALWAYS_FALSE,
    });

    expect(items.find((i) => i.metricKey === 'CONTROL_INACTIVE_COUNT')?.threshold).toBeUndefined();
  });

  it('surfaces definition name/description only from an active definition, dropping an empty description', () => {
    const active = buildDefinition({
      metricKey: 'CONTROL_INACTIVE_COUNT',
      name: 'Meu indicador',
      description: '',
    });
    const items = buildIndicatorOverviewItems({
      metrics: [],
      definitions: [active],
      hasPermission: ALWAYS_FALSE,
    });

    expect(items.find((i) => i.metricKey === 'CONTROL_INACTIVE_COUNT')?.definition).toEqual({
      name: 'Meu indicador',
      description: undefined,
    });
  });

  it('has no definition/threshold at all for a key with no definition row', () => {
    const items = buildIndicatorOverviewItems({
      metrics: [],
      definitions: [],
      hasPermission: ALWAYS_FALSE,
    });
    const item = items.find((i) => i.metricKey === 'CONTROL_INACTIVE_COUNT');

    expect(item?.threshold).toBeUndefined();
    expect(item?.definition).toBeUndefined();
  });

  it('always sets detailHref to /indicators/{metricKey} regardless of permission', () => {
    const items = buildIndicatorOverviewItems({
      metrics: [],
      definitions: [],
      hasPermission: ALWAYS_FALSE,
    });

    expect(items.find((i) => i.metricKey === 'RISK_TOTAL_BY_LEVEL')?.detailHref).toBe(
      '/indicators/RISK_TOTAL_BY_LEVEL',
    );
  });
});

describe('resolveIndicatorNavigation', () => {
  const table: Partial<Record<IndicatorMetricKey, IndicatorNavigationEntry>> = {
    ASSET_INACTIVE_COUNT: {
      permission: 'asset:view',
      recordsHref: '/assets?isActive=false',
    },
    RISK_TOTAL_BY_LEVEL: {
      permission: 'risk:view',
      recordsHref: '/risks',
      bucketHref: (bucketKey) => `/risks?riskLevel=${bucketKey}`,
    },
  };

  it('produces no link for a key absent from the table, regardless of permission', () => {
    const resolution = resolveIndicatorNavigation('CONTROL_INACTIVE_COUNT', ALWAYS_TRUE, table);
    expect(resolution.recordsHref).toBeUndefined();
    expect(resolution.bucketHref('CRITICAL')).toBeUndefined();
  });

  it('produces no link when the table has an entry but the caller lacks its permission', () => {
    const resolution = resolveIndicatorNavigation('ASSET_INACTIVE_COUNT', ALWAYS_FALSE, table);
    expect(resolution.recordsHref).toBeUndefined();
  });

  it('produces the exact link when the table has an entry and the caller holds its permission', () => {
    const resolution = resolveIndicatorNavigation('ASSET_INACTIVE_COUNT', ALWAYS_TRUE, table);
    expect(resolution.recordsHref).toBe('/assets?isActive=false');
  });

  it('produces per-bucket links only when permitted', () => {
    const permitted = resolveIndicatorNavigation('RISK_TOTAL_BY_LEVEL', ALWAYS_TRUE, table);
    expect(permitted.bucketHref('CRITICAL')).toBe('/risks?riskLevel=CRITICAL');

    const denied = resolveIndicatorNavigation('RISK_TOTAL_BY_LEVEL', ALWAYS_FALSE, table);
    expect(denied.bucketHref('CRITICAL')).toBeUndefined();
  });
});

describe('INDICATOR_NAVIGATION_TABLE (approved, default table)', () => {
  it('RISK_TOTAL_BY_LEVEL never has a recordsHref, even with risk:view (no exact "all" link exists)', () => {
    const resolution = resolveIndicatorNavigation('RISK_TOTAL_BY_LEVEL', ALWAYS_TRUE);
    expect(resolution.recordsHref).toBeUndefined();
  });

  it('RISK_TOTAL_BY_LEVEL bucket links carry riskLevel + explicit riskLevelBasis=RESIDUAL, gated on risk:view', () => {
    const permitted = resolveIndicatorNavigation('RISK_TOTAL_BY_LEVEL', ALWAYS_TRUE);
    expect(permitted.bucketHref('CRITICAL')).toBe(
      '/risks?riskLevel=CRITICAL&riskLevelBasis=RESIDUAL',
    );
    expect(permitted.bucketHref('LOW')).toBe('/risks?riskLevel=LOW&riskLevelBasis=RESIDUAL');

    const denied = resolveIndicatorNavigation('RISK_TOTAL_BY_LEVEL', ALWAYS_FALSE);
    expect(denied.bucketHref('CRITICAL')).toBeUndefined();
  });

  it('RISK_TREATMENT_OVERDUE_COUNT links to the Action register (not /risks?overdueTreatment=true), gated on action:view', () => {
    const permitted = resolveIndicatorNavigation('RISK_TREATMENT_OVERDUE_COUNT', ALWAYS_TRUE);
    expect(permitted.recordsHref).toBe(
      '/actions?overdue=true&originType=RISK_TREATMENT&onlyMine=false',
    );
  });

  it('RISK_TREATMENT_OVERDUE_COUNT link disappears without action:view, even with risk:view', () => {
    const hasOnlyRiskView = (permission: string): boolean => permission === 'risk:view';
    const resolution = resolveIndicatorNavigation('RISK_TREATMENT_OVERDUE_COUNT', hasOnlyRiskView);
    expect(resolution.recordsHref).toBeUndefined();
  });

  it('CONTROL_INACTIVE_COUNT links to /controls?status=DRAFT,SUSPENDED,RETIRED, gated on control:view', () => {
    const permitted = resolveIndicatorNavigation('CONTROL_INACTIVE_COUNT', ALWAYS_TRUE);
    expect(permitted.recordsHref).toBe('/controls?status=DRAFT,SUSPENDED,RETIRED');

    const denied = resolveIndicatorNavigation('CONTROL_INACTIVE_COUNT', ALWAYS_FALSE);
    expect(denied.recordsHref).toBeUndefined();
  });

  it('ASSET_INACTIVE_COUNT links to /assets?isActive=false, gated on asset:view', () => {
    const permitted = resolveIndicatorNavigation('ASSET_INACTIVE_COUNT', ALWAYS_TRUE);
    expect(permitted.recordsHref).toBe('/assets?isActive=false');

    const denied = resolveIndicatorNavigation('ASSET_INACTIVE_COUNT', ALWAYS_FALSE);
    expect(denied.recordsHref).toBeUndefined();
  });

  it('PROCESS_INACTIVE_COUNT links to /processes?isActive=false, gated on process:view', () => {
    const permitted = resolveIndicatorNavigation('PROCESS_INACTIVE_COUNT', ALWAYS_TRUE);
    expect(permitted.recordsHref).toBe('/processes?isActive=false');

    const denied = resolveIndicatorNavigation('PROCESS_INACTIVE_COUNT', ALWAYS_FALSE);
    expect(denied.recordsHref).toBeUndefined();
  });

  it('ACTION_OVERDUE_COUNT links to /actions?overdue=true&onlyMine=false (onlyMine=false mandatory), gated on action:view', () => {
    const permitted = resolveIndicatorNavigation('ACTION_OVERDUE_COUNT', ALWAYS_TRUE);
    expect(permitted.recordsHref).toBe('/actions?overdue=true&onlyMine=false');

    const denied = resolveIndicatorNavigation('ACTION_OVERDUE_COUNT', ALWAYS_FALSE);
    expect(denied.recordsHref).toBeUndefined();
  });

  it('INCIDENT_OPEN_COUNT_BY_SEVERITY links to the open-status total and per-severity bucket URLs, gated on incident:view', () => {
    const permitted = resolveIndicatorNavigation('INCIDENT_OPEN_COUNT_BY_SEVERITY', ALWAYS_TRUE);
    expect(permitted.recordsHref).toBe('/incidents?status=OPEN,IN_PROGRESS,RESOLVED');
    expect(permitted.bucketHref('CRITICAL')).toBe(
      '/incidents?status=OPEN,IN_PROGRESS,RESOLVED&severity=CRITICAL',
    );

    const denied = resolveIndicatorNavigation('INCIDENT_OPEN_COUNT_BY_SEVERITY', ALWAYS_FALSE);
    expect(denied.recordsHref).toBeUndefined();
    expect(denied.bucketHref('CRITICAL')).toBeUndefined();
  });

  it('PROBLEM_OPEN_COUNT_BY_SEVERITY links to the open-status total and per-severity bucket URLs, gated on problem:view', () => {
    const permitted = resolveIndicatorNavigation('PROBLEM_OPEN_COUNT_BY_SEVERITY', ALWAYS_TRUE);
    expect(permitted.recordsHref).toBe('/problems?status=OPEN,IN_ANALYSIS,RESOLVED');
    expect(permitted.bucketHref('HIGH')).toBe(
      '/problems?status=OPEN,IN_ANALYSIS,RESOLVED&severity=HIGH',
    );

    const denied = resolveIndicatorNavigation('PROBLEM_OPEN_COUNT_BY_SEVERITY', ALWAYS_FALSE);
    expect(denied.recordsHref).toBeUndefined();
    expect(denied.bucketHref('HIGH')).toBeUndefined();
  });

  it.each<IndicatorMetricKey>([
    'AUDIT_ENGAGEMENT_OPEN_COUNT',
    'FINDING_OPEN_COUNT_BY_SEVERITY',
    'COMPLIANCE_PERCENTAGE',
  ])(
    '%s never has a link, even with every permission granted (no exact register target exists)',
    (metricKey) => {
      const resolution = resolveIndicatorNavigation(metricKey, ALWAYS_TRUE);
      expect(resolution.recordsHref).toBeUndefined();
      expect(resolution.bucketHref('CRITICAL')).toBeUndefined();
    },
  );

  it('has an entry for exactly the 8 approved keys, nothing more', () => {
    expect(Object.keys(INDICATOR_NAVIGATION_TABLE).sort()).toEqual(
      [
        'ACTION_OVERDUE_COUNT',
        'ASSET_INACTIVE_COUNT',
        'CONTROL_INACTIVE_COUNT',
        'INCIDENT_OPEN_COUNT_BY_SEVERITY',
        'PROBLEM_OPEN_COUNT_BY_SEVERITY',
        'PROCESS_INACTIVE_COUNT',
        'RISK_TOTAL_BY_LEVEL',
        'RISK_TREATMENT_OVERDUE_COUNT',
      ].sort(),
    );
  });
});

describe('buildIndicatorOverviewItems — navigation wiring end to end', () => {
  const table: Partial<Record<IndicatorMetricKey, IndicatorNavigationEntry>> = {
    ASSET_INACTIVE_COUNT: { permission: 'asset:view', recordsHref: '/assets?isActive=false' },
    RISK_TOTAL_BY_LEVEL: {
      permission: 'risk:view',
      recordsHref: '/risks',
      bucketHref: (bucketKey) => `/risks?riskLevel=${bucketKey}`,
    },
  };

  it('sets recordsHref only when permitted', () => {
    const permitted = buildIndicatorOverviewItems({
      metrics: [],
      definitions: [],
      hasPermission: ALWAYS_TRUE,
      navigationTable: table,
    });
    expect(permitted.find((i) => i.metricKey === 'ASSET_INACTIVE_COUNT')?.recordsHref).toBe(
      '/assets?isActive=false',
    );

    const denied = buildIndicatorOverviewItems({
      metrics: [],
      definitions: [],
      hasPermission: ALWAYS_FALSE,
      navigationTable: table,
    });
    expect(denied.find((i) => i.metricKey === 'ASSET_INACTIVE_COUNT')?.recordsHref).toBeUndefined();
  });

  it('sets each bucket href only when permitted, per-bucket', () => {
    const metrics: DashboardSummaryMetric[] = [
      {
        metricKey: 'RISK_TOTAL_BY_LEVEL',
        shape: 'BY_BUCKET',
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        valueByBucket: { LOW: 117, MEDIUM: 2, HIGH: 0, CRITICAL: 57 },
      },
    ];

    const permitted = buildIndicatorOverviewItems({
      metrics,
      definitions: [],
      hasPermission: ALWAYS_TRUE,
      navigationTable: table,
    });
    const permittedReading = permitted.find((i) => i.metricKey === 'RISK_TOTAL_BY_LEVEL')?.reading;
    expect(permittedReading?.kind).toBe('buckets');
    if (permittedReading?.kind === 'buckets') {
      expect(permittedReading.buckets.find((b) => b.key === 'CRITICAL')?.href).toBe(
        '/risks?riskLevel=CRITICAL',
      );
    }

    const denied = buildIndicatorOverviewItems({
      metrics,
      definitions: [],
      hasPermission: ALWAYS_FALSE,
      navigationTable: table,
    });
    const deniedReading = denied.find((i) => i.metricKey === 'RISK_TOTAL_BY_LEVEL')?.reading;
    if (deniedReading?.kind === 'buckets') {
      expect(deniedReading.buckets.every((b) => b.href === undefined)).toBe(true);
    }
  });
});

describe('buildIndicatorMonitoring', () => {
  it('is undefined when breakdowns.indicators is absent', () => {
    expect(buildIndicatorMonitoring(undefined)).toBeUndefined();
    expect(buildIndicatorMonitoring({})).toBeUndefined();
  });

  it('returns the exact monitored/breached numbers when present', () => {
    expect(buildIndicatorMonitoring({ indicators: { monitored: 3, breached: 1 } })).toEqual({
      monitored: 3,
      breached: 1,
    });
  });
});

describe('buildIndicatorOverviewData', () => {
  it('composes items + monitoring + fetchedAt', () => {
    const fetchedAt = new Date('2026-09-15T12:00:00.000Z');
    const data = buildIndicatorOverviewData({
      metrics: [],
      breakdowns: { indicators: { monitored: 2, breached: 0 } },
      definitions: [],
      hasPermission: ALWAYS_FALSE,
      fetchedAt,
    });

    expect(data.items).toHaveLength(11);
    expect(data.monitoring).toEqual({ monitored: 2, breached: 0 });
    expect(data.fetchedAt).toBe(fetchedAt);
  });
});
