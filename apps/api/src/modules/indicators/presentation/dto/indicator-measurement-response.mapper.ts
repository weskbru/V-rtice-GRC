/**
 * 009-indicators-reports, Fase 4 (T037) — maps
 * `IndicatorMeasurementRecord` + its resolved `computedBy` ref (application
 * layer) to the wire shape `contracts/indicators.openapi.yaml`'s
 * `IndicatorMeasurement` schema describes. ONE function is the only place
 * this happens (ADR-009), mirroring `toIndicatorDefinitionResponse`'s own
 * single-mapper discipline.
 */
import type { IndicatorOwnerRef } from '../../application/resolve-indicator-owner';
import type { IndicatorMeasurementRecord } from '../../domain/indicator-measurement.entity';
import type { IndicatorMetricKey } from '@prisma/client';

export interface IndicatorMeasurementComputedByResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface IndicatorMeasurementResponse {
  readonly id: string;
  readonly metricKey: IndicatorMetricKey;
  readonly value: number | null;
  readonly valueByBucket: Record<string, number> | null;
  readonly breached: boolean;
  readonly computedAt: string;
  readonly computedBy: IndicatorMeasurementComputedByResponse;
}

export function toIndicatorMeasurementResponse(
  record: IndicatorMeasurementRecord,
  computedBy: IndicatorOwnerRef,
): IndicatorMeasurementResponse {
  return {
    id: record.id,
    metricKey: record.metricKey,
    value: record.value,
    valueByBucket: record.valueByBucket ? { ...record.valueByBucket } : null,
    breached: record.breached,
    computedAt: record.computedAt.toISOString(),
    computedBy: { id: computedBy.id, fullName: computedBy.fullName },
  };
}
