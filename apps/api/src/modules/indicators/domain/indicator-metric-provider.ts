import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { IndicatorMetricKey } from '@prisma/client';

export type IndicatorMetricValue =
  | { readonly shape: 'SINGLE_VALUE'; readonly value: number | undefined }
  | { readonly shape: 'BY_BUCKET'; readonly valueByBucket: Readonly<Record<string, number>> };

export interface ScopedIndicatorMetricProvider {
  readonly metricKey: IndicatorMetricKey;
  computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue>;
}

export interface OrganizationWideIndicatorMetricProvider {
  readonly metricKey: IndicatorMetricKey;
  computeValue(): Promise<IndicatorMetricValue>;
}
