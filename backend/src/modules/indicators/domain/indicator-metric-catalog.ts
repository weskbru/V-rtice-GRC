import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { IndicatorMetricKey } from '@prisma/client';

export type IndicatorMetricScopeApplicability = 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';

export type IndicatorMetricShape = 'SINGLE_VALUE' | 'BY_BUCKET';

export interface IndicatorMetricCatalogEntry {
  readonly sourcePermission: PermissionIdentifier;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly shape: IndicatorMetricShape;
}

export const INDICATOR_METRIC_CATALOG: Readonly<
  Record<IndicatorMetricKey, IndicatorMetricCatalogEntry>
> = {
  RISK_TOTAL_BY_LEVEL: {
    sourcePermission: 'risk:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'BY_BUCKET',
  },
  RISK_TREATMENT_OVERDUE_COUNT: {
    sourcePermission: 'risk:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  CONTROL_INACTIVE_COUNT: {
    sourcePermission: 'control:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  COMPLIANCE_PERCENTAGE: {
    sourcePermission: 'compliance:view',
    scopeApplicability: 'ORGANIZATION_WIDE',
    shape: 'SINGLE_VALUE',
  },
  AUDIT_ENGAGEMENT_OPEN_COUNT: {
    sourcePermission: 'audit-engagement:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  FINDING_OPEN_COUNT_BY_SEVERITY: {
    sourcePermission: 'finding:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'BY_BUCKET',
  },
  ASSET_INACTIVE_COUNT: {
    sourcePermission: 'asset:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  PROCESS_INACTIVE_COUNT: {
    sourcePermission: 'process:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  ACTION_OVERDUE_COUNT: {
    sourcePermission: 'action:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'SINGLE_VALUE',
  },
  INCIDENT_OPEN_COUNT_BY_SEVERITY: {
    sourcePermission: 'incident:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'BY_BUCKET',
  },
  PROBLEM_OPEN_COUNT_BY_SEVERITY: {
    sourcePermission: 'problem:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    shape: 'BY_BUCKET',
  },
};

export function getIndicatorMetricCatalogEntry(
  metricKey: IndicatorMetricKey,
): IndicatorMetricCatalogEntry {
  return INDICATOR_METRIC_CATALOG[metricKey];
}

export function listAllIndicatorMetricKeys(): readonly IndicatorMetricKey[] {
  return Object.keys(INDICATOR_METRIC_CATALOG) as IndicatorMetricKey[];
}

export function isIndicatorMetricKey(value: string): value is IndicatorMetricKey {
  return Object.prototype.hasOwnProperty.call(INDICATOR_METRIC_CATALOG, value);
}

export function findIndicatorMetricCatalogEntry(
  value: string,
): (IndicatorMetricCatalogEntry & { readonly metricKey: IndicatorMetricKey }) | undefined {
  if (!isIndicatorMetricKey(value)) {
    return undefined;
  }
  return { metricKey: value, ...INDICATOR_METRIC_CATALOG[value] };
}
