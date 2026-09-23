import type { IndicatorMetricCatalogSummary } from '../../application/list-indicator-metric-keys.usecase';
import type {
  IndicatorMetricScopeApplicability,
  IndicatorMetricShape,
} from '../../domain/indicator-metric-catalog';
import type { IndicatorMetricKey } from '@prisma/client';

export interface IndicatorMetricCatalogEntryResponse {
  readonly metricKey: IndicatorMetricKey;
  readonly defaultLabel: string;
  readonly sourcePermission: string;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly shape: IndicatorMetricShape;
  readonly hasDefinition: boolean;
}

export function toIndicatorMetricCatalogEntryResponse(
  summary: IndicatorMetricCatalogSummary,
): IndicatorMetricCatalogEntryResponse {
  return {
    metricKey: summary.metricKey,
    defaultLabel: summary.defaultLabel,
    sourcePermission: summary.sourcePermission,
    scopeApplicability: summary.scopeApplicability,
    shape: summary.shape,
    hasDefinition: summary.hasDefinition,
  };
}
