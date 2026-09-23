import { Injectable } from '@nestjs/common';

import { ProcessMetricsPort } from '../../../../shared/grc-ports/process-metrics.port';

import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  IndicatorMetricValue,
  ScopedIndicatorMetricProvider,
} from '../../domain/indicator-metric-provider';

@Injectable()
export class ProcessInactiveCountProvider implements ScopedIndicatorMetricProvider {
  readonly metricKey = 'PROCESS_INACTIVE_COUNT' as const;

  constructor(private readonly processMetrics: ProcessMetricsPort) {}

  async computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue> {
    const inactiveCount = await this.processMetrics.getInactiveCount(scope);
    return { shape: 'SINGLE_VALUE', value: inactiveCount };
  }
}
