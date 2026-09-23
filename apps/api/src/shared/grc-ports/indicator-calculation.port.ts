import type { ScopeFilter } from '../persistence/scope-filter';
import type { IndicatorMetricKey } from '@prisma/client';

export type IndicatorMetricScopeApplicability = 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';
export type IndicatorMetricShape = 'SINGLE_VALUE' | 'BY_BUCKET';

export interface IndicatorMetricPortMetadata {
  readonly sourcePermission: string;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
}

export interface IndicatorCalculationPortResult {
  readonly metricKey: IndicatorMetricKey;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly shape: IndicatorMetricShape;
  readonly value: number | undefined;
  readonly valueByBucket: Readonly<Record<string, number>> | undefined;
}

export abstract class IndicatorCalculationPort {
  abstract getMetadata(metricKey: IndicatorMetricKey): IndicatorMetricPortMetadata;

  abstract calculate(input: {
    readonly metricKey: IndicatorMetricKey;
    readonly scope: ScopeFilter;
  }): Promise<IndicatorCalculationPortResult>;
}
