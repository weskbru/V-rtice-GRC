import type { IndicatorMetricKey, IndicatorThresholdComparator } from '@prisma/client';

export interface IndicatorDefinitionRecord {
  readonly id: string;
  readonly code: string;
  readonly metricKey: IndicatorMetricKey;
  readonly name: string;
  readonly description: string;
  readonly ownerUserId: string;
  readonly thresholdComparator: IndicatorThresholdComparator | null;
  readonly thresholdValue: number | null;
  readonly isActive: boolean;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
