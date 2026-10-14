import type { IndicatorMeasurementRecord } from '../indicator-measurement.entity';
import type { IndicatorMetricKey } from '@prisma/client';

export interface CreateIndicatorMeasurementInput {
  readonly metricKey: IndicatorMetricKey;
  readonly value: number | null;
  readonly valueByBucket: Readonly<Record<string, number>> | null;
  readonly breached: boolean;
  readonly computedByUserId: string;
}

export interface IndicatorMeasurementListQuery {
  readonly metricKey: IndicatorMetricKey;
  readonly page: number;
  readonly pageSize: number;
}

export interface IndicatorMeasurementListPage {
  readonly items: readonly IndicatorMeasurementRecord[];
  readonly total: number;
}

export abstract class IndicatorMeasurementRepositoryPort {
  abstract create(input: CreateIndicatorMeasurementInput): Promise<IndicatorMeasurementRecord>;

  abstract list(query: IndicatorMeasurementListQuery): Promise<IndicatorMeasurementListPage>;
}
