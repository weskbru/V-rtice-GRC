/**
 * 009-indicators-reports, Fase 8 (T068 prep) — maps
 * `IndicatorMetricCatalogSummary` (application layer) to the wire shape
 * `contracts/indicators.openapi.yaml`'s `IndicatorMetricCatalogEntry`
 * schema describes. ONE function is the only place this happens (ADR-009),
 * mirroring `toIndicatorDefinitionResponse`'s own single-mapper
 * discipline — even though the two shapes are structurally close, this is
 * the one place `PermissionIdentifier` (a compile-time union) becomes the
 * wire contract's plain `string`.
 */
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
