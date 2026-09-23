import { BUCKET_LEVEL_ORDER } from '../metric-visuals';

import type {
  IndicatorDefinition,
  IndicatorMetricKey,
  IndicatorMetricShape,
  IndicatorScopeApplicability,
  IndicatorThresholdComparator,
} from '../types';
import type { DashboardBreakdowns, DashboardSummaryMetric } from '@/features/dashboard/types';
import type { PermissionId } from '@/lib/permissions';

export type IndicatorDomain =
  | 'RISK'
  | 'ACTION'
  | 'PROBLEM'
  | 'INCIDENT'
  | 'CONTROL'
  | 'ASSET'
  | 'PROCESS'
  | 'COMPLIANCE'
  | 'AUDIT'
  | 'FINDING';

export interface IndicatorThreshold {
  readonly comparator: IndicatorThresholdComparator;
  readonly value: number;
}

export interface IndicatorBucket {
  readonly key: string;
  readonly count: number;
  readonly href?: string;
}

export type IndicatorReading =
  | { readonly kind: 'single'; readonly value: number; readonly unit: 'count' | 'percent' }
  | {
      readonly kind: 'buckets';
      readonly buckets: readonly IndicatorBucket[];
      readonly total: number;
    }
  | { readonly kind: 'no-data' }
  | { readonly kind: 'no-permission' };

export interface IndicatorOverviewItem {
  readonly metricKey: IndicatorMetricKey;
  readonly domain: IndicatorDomain;
  readonly shape: IndicatorMetricShape;
  readonly scopeApplicability: IndicatorScopeApplicability;
  readonly reading: IndicatorReading;
  readonly detailHref: string;
  readonly recordsHref?: string;
  readonly threshold?: IndicatorThreshold;
  readonly definition?: { readonly name: string; readonly description?: string };
}

export interface IndicatorOverviewData {
  readonly items: readonly IndicatorOverviewItem[];
  readonly monitoring?: { readonly monitored: number; readonly breached: number };
  readonly fetchedAt: Date;
}

const INDICATOR_CATALOG: Readonly<
  Record<
    IndicatorMetricKey,
    {
      domain: IndicatorDomain;
      shape: IndicatorMetricShape;
      scopeApplicability: IndicatorScopeApplicability;
    }
  >
> = {
  RISK_TOTAL_BY_LEVEL: {
    domain: 'RISK',
    shape: 'BY_BUCKET',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  RISK_TREATMENT_OVERDUE_COUNT: {
    domain: 'RISK',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  CONTROL_INACTIVE_COUNT: {
    domain: 'CONTROL',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  COMPLIANCE_PERCENTAGE: {
    domain: 'COMPLIANCE',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATION_WIDE',
  },
  AUDIT_ENGAGEMENT_OPEN_COUNT: {
    domain: 'AUDIT',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  FINDING_OPEN_COUNT_BY_SEVERITY: {
    domain: 'FINDING',
    shape: 'BY_BUCKET',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  ASSET_INACTIVE_COUNT: {
    domain: 'ASSET',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  PROCESS_INACTIVE_COUNT: {
    domain: 'PROCESS',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  ACTION_OVERDUE_COUNT: {
    domain: 'ACTION',
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  INCIDENT_OPEN_COUNT_BY_SEVERITY: {
    domain: 'INCIDENT',
    shape: 'BY_BUCKET',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  PROBLEM_OPEN_COUNT_BY_SEVERITY: {
    domain: 'PROBLEM',
    shape: 'BY_BUCKET',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
};

export const INDICATOR_METRIC_KEY_ORDER: readonly IndicatorMetricKey[] = Object.keys(
  INDICATOR_CATALOG,
) as readonly IndicatorMetricKey[];

export function indicatorDomain(metricKey: IndicatorMetricKey): IndicatorDomain {
  return INDICATOR_CATALOG[metricKey].domain;
}

export interface IndicatorNavigationEntry {
  readonly permission: PermissionId;
  readonly recordsHref?: string;
  readonly bucketHref?: (bucketKey: string) => string | undefined;
}

export const INDICATOR_NAVIGATION_TABLE: Readonly<
  Partial<Record<IndicatorMetricKey, IndicatorNavigationEntry>>
> = {
  RISK_TOTAL_BY_LEVEL: {
    permission: 'risk:view',
    bucketHref: (bucketKey) => `/risks?riskLevel=${bucketKey}&riskLevelBasis=RESIDUAL`,
  },
  RISK_TREATMENT_OVERDUE_COUNT: {
    permission: 'action:view',
    recordsHref: '/actions?overdue=true&originType=RISK_TREATMENT&onlyMine=false',
  },
  CONTROL_INACTIVE_COUNT: {
    permission: 'control:view',
    recordsHref: '/controls?status=DRAFT,SUSPENDED,RETIRED',
  },
  ASSET_INACTIVE_COUNT: {
    permission: 'asset:view',
    recordsHref: '/assets?isActive=false',
  },
  PROCESS_INACTIVE_COUNT: {
    permission: 'process:view',
    recordsHref: '/processes?isActive=false',
  },
  ACTION_OVERDUE_COUNT: {
    permission: 'action:view',
    recordsHref: '/actions?overdue=true&onlyMine=false',
  },
  INCIDENT_OPEN_COUNT_BY_SEVERITY: {
    permission: 'incident:view',
    recordsHref: '/incidents?status=OPEN,IN_PROGRESS,RESOLVED',
    bucketHref: (bucketKey) => `/incidents?status=OPEN,IN_PROGRESS,RESOLVED&severity=${bucketKey}`,
  },
  PROBLEM_OPEN_COUNT_BY_SEVERITY: {
    permission: 'problem:view',
    recordsHref: '/problems?status=OPEN,IN_ANALYSIS,RESOLVED',
    bucketHref: (bucketKey) => `/problems?status=OPEN,IN_ANALYSIS,RESOLVED&severity=${bucketKey}`,
  },
};

export interface IndicatorNavigationResolution {
  readonly recordsHref?: string;
  readonly bucketHref: (bucketKey: string) => string | undefined;
}

export function resolveIndicatorNavigation(
  metricKey: IndicatorMetricKey,
  hasPermission: (permission: PermissionId) => boolean,
  table: Readonly<
    Partial<Record<IndicatorMetricKey, IndicatorNavigationEntry>>
  > = INDICATOR_NAVIGATION_TABLE,
): IndicatorNavigationResolution {
  const entry = table[metricKey];
  if (!entry || !hasPermission(entry.permission)) {
    return { recordsHref: undefined, bucketHref: () => undefined };
  }
  return {
    recordsHref: entry.recordsHref,
    bucketHref: (bucketKey) => entry.bucketHref?.(bucketKey),
  };
}

function buildReading(
  metric: DashboardSummaryMetric | undefined,
  metricKey: IndicatorMetricKey,
  bucketHref: (bucketKey: string) => string | undefined,
): IndicatorReading {
  if (!metric) {
    return { kind: 'no-permission' };
  }

  if (metric.shape === 'BY_BUCKET') {
    if (!metric.valueByBucket) {
      return { kind: 'no-data' };
    }
    const source = metric.valueByBucket;
    const buckets: IndicatorBucket[] = BUCKET_LEVEL_ORDER.map((level) => ({
      key: level,
      count: source[level] ?? 0,
      href: bucketHref(level),
    }));
    const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    return { kind: 'buckets', buckets, total };
  }

  if (typeof metric.value !== 'number') {
    return { kind: 'no-data' };
  }

  return {
    kind: 'single',
    value: metric.value,
    unit: metricKey === 'COMPLIANCE_PERCENTAGE' ? 'percent' : 'count',
  };
}

function buildThreshold(
  definition: IndicatorDefinition | undefined,
): IndicatorThreshold | undefined {
  if (!definition?.isActive) return undefined;
  if (!definition.thresholdComparator || typeof definition.thresholdValue !== 'number') {
    return undefined;
  }
  return { comparator: definition.thresholdComparator, value: definition.thresholdValue };
}

function buildDefinitionSummary(
  definition: IndicatorDefinition | undefined,
): { name: string; description?: string } | undefined {
  if (!definition?.isActive) return undefined;
  return { name: definition.name, description: definition.description || undefined };
}

export interface BuildIndicatorOverviewItemsParams {
  readonly metrics: readonly DashboardSummaryMetric[];
  readonly definitions: readonly IndicatorDefinition[];
  readonly hasPermission: (permission: PermissionId) => boolean;
  readonly navigationTable?: Readonly<
    Partial<Record<IndicatorMetricKey, IndicatorNavigationEntry>>
  >;
}

export function buildIndicatorOverviewItems(
  params: BuildIndicatorOverviewItemsParams,
): IndicatorOverviewItem[] {
  const { metrics, definitions, hasPermission, navigationTable } = params;

  const metricsByKey = new Map(metrics.map((metric) => [metric.metricKey, metric]));
  const definitionsByKey = new Map(
    definitions.map((definition) => [definition.metricKey, definition]),
  );

  return INDICATOR_METRIC_KEY_ORDER.map((metricKey) => {
    const catalogEntry = INDICATOR_CATALOG[metricKey];
    const metric = metricsByKey.get(metricKey);
    const definition = definitionsByKey.get(metricKey);
    const navigation = resolveIndicatorNavigation(metricKey, hasPermission, navigationTable);

    const item: IndicatorOverviewItem = {
      metricKey,
      domain: catalogEntry.domain,
      shape: metric?.shape ?? catalogEntry.shape,
      scopeApplicability: metric?.scopeApplicability ?? catalogEntry.scopeApplicability,
      reading: buildReading(metric, metricKey, navigation.bucketHref),
      detailHref: `/indicators/${metricKey}`,
      recordsHref: navigation.recordsHref,
      threshold: buildThreshold(definition),
      definition: buildDefinitionSummary(definition),
    };
    return item;
  });
}

export function buildIndicatorMonitoring(
  breakdowns: DashboardBreakdowns | undefined,
): { monitored: number; breached: number } | undefined {
  const block = breakdowns?.indicators;
  return block ? { monitored: block.monitored, breached: block.breached } : undefined;
}

export interface BuildIndicatorOverviewDataParams {
  readonly metrics: readonly DashboardSummaryMetric[];
  readonly breakdowns: DashboardBreakdowns | undefined;
  readonly definitions: readonly IndicatorDefinition[];
  readonly hasPermission: (permission: PermissionId) => boolean;
  readonly fetchedAt: Date;
  readonly navigationTable?: Readonly<
    Partial<Record<IndicatorMetricKey, IndicatorNavigationEntry>>
  >;
}

export function buildIndicatorOverviewData(
  params: BuildIndicatorOverviewDataParams,
): IndicatorOverviewData {
  return {
    items: buildIndicatorOverviewItems({
      metrics: params.metrics,
      definitions: params.definitions,
      hasPermission: params.hasPermission,
      navigationTable: params.navigationTable,
    }),
    monitoring: buildIndicatorMonitoring(params.breakdowns),
    fetchedAt: params.fetchedAt,
  };
}
