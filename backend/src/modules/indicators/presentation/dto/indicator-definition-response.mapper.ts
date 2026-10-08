import type { IndicatorOwnerRef } from '../../application/resolve-indicator-owner';
import type { IndicatorDefinitionRecord } from '../../domain/indicator-definition.entity';
import type { IndicatorMetricKey, IndicatorThresholdComparator } from '@prisma/client';

export interface IndicatorOwnerRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface IndicatorDefinitionResponse {
  readonly id: string;
  readonly code: string;
  readonly metricKey: IndicatorMetricKey;
  readonly name: string;
  readonly description: string;
  readonly owner: IndicatorOwnerRefResponse;
  readonly thresholdComparator: IndicatorThresholdComparator | null;
  readonly thresholdValue: number | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toIndicatorDefinitionResponse(
  record: IndicatorDefinitionRecord,
  owner: IndicatorOwnerRef,
): IndicatorDefinitionResponse {
  return {
    id: record.id,
    code: record.code,
    metricKey: record.metricKey,
    name: record.name,
    description: record.description,
    owner: { id: owner.id, fullName: owner.fullName },
    thresholdComparator: record.thresholdComparator,
    thresholdValue: record.thresholdValue,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
