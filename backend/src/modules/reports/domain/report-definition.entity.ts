import type { IndicatorMetricKey } from '@prisma/client';

export interface ReportDefinitionRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly metricKeys: readonly IndicatorMetricKey[];
  readonly isActive: boolean;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
