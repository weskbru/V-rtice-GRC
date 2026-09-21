/**
 * 009-indicators-reports, Fase 3 (T031) — maps
 * `GetIndicatorCurrentValueResult` (application layer) to the wire shape
 * `contracts/indicators.openapi.yaml`'s `IndicatorCurrentValue` schema
 * describes. ONE function is the only place this happens (ADR-009).
 */
import { toIndicatorDefinitionResponse } from './indicator-definition-response.mapper';

import type { IndicatorDefinitionResponse } from './indicator-definition-response.mapper';
import type { GetIndicatorCurrentValueResult } from '../../application/get-indicator-current-value.usecase';
import type {
  IndicatorMetricScopeApplicability,
  IndicatorMetricShape,
} from '../../domain/indicator-metric-catalog';
import type { IndicatorMetricKey } from '@prisma/client';

export interface IndicatorCurrentValueResponse {
  readonly metricKey: IndicatorMetricKey;
  readonly shape: IndicatorMetricShape;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly value: number | null;
  readonly valueByBucket: Record<string, number> | null;
  readonly definition: IndicatorDefinitionResponse | null;
  readonly computedAt: string;
}

export function toIndicatorCurrentValueResponse(
  result: GetIndicatorCurrentValueResult,
): IndicatorCurrentValueResponse {
  return {
    metricKey: result.metricKey,
    shape: result.shape,
    scopeApplicability: result.scopeApplicability,
    value: result.value ?? null,
    valueByBucket: result.valueByBucket ? { ...result.valueByBucket } : null,
    definition: result.definition
      ? toIndicatorDefinitionResponse(result.definition.record, result.definition.owner)
      : null,
    computedAt: result.computedAt.toISOString(),
  };
}
