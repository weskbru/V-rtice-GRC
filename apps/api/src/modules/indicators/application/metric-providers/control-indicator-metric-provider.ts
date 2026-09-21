/**
 * 009-indicators-reports, T020 — `CONTROL_INACTIVE_COUNT`. Delegates to
 * `ControlMetricsPort` (`shared/grc-ports/control-metrics.port.ts`), which
 * itself reuses `ControlQueryService.listCatalog` — no query of this
 * file's own.
 */
import { Injectable } from '@nestjs/common';

import { ControlMetricsPort } from '../../../../shared/grc-ports/control-metrics.port';

import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  IndicatorMetricValue,
  ScopedIndicatorMetricProvider,
} from '../../domain/indicator-metric-provider';

@Injectable()
export class ControlInactiveCountProvider implements ScopedIndicatorMetricProvider {
  readonly metricKey = 'CONTROL_INACTIVE_COUNT' as const;

  constructor(private readonly controlMetrics: ControlMetricsPort) {}

  async computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue> {
    const inactiveCount = await this.controlMetrics.getInactiveCount(scope);
    return { shape: 'SINGLE_VALUE', value: inactiveCount };
  }
}
