import type { IndicatorMetricKey } from '@prisma/client';

export interface IndicatorMeasurementRecord {
  readonly id: string;
  readonly metricKey: IndicatorMetricKey;
  readonly value: number | null;
  readonly valueByBucket: Readonly<Record<string, number>> | null;
  readonly breached: boolean;
  readonly computedAt: Date;
  readonly computedByUserId: string;
}
