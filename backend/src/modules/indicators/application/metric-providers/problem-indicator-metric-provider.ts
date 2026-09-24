import { Injectable } from '@nestjs/common';

import { ProblemMetricsPort } from '../../../../shared/grc-ports/problem-metrics.port';

import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  IndicatorMetricValue,
  ScopedIndicatorMetricProvider,
} from '../../domain/indicator-metric-provider';

@Injectable()
export class ProblemOpenCountBySeverityProvider implements ScopedIndicatorMetricProvider {
  readonly metricKey = 'PROBLEM_OPEN_COUNT_BY_SEVERITY' as const;

  constructor(private readonly problemMetrics: ProblemMetricsPort) {}

  async computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue> {
    const bySeverity = await this.problemMetrics.getOpenCountBySeverity(scope);
    return { shape: 'BY_BUCKET', valueByBucket: bySeverity };
  }
}
