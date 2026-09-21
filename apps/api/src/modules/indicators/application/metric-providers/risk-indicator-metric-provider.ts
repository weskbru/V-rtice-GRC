/**
 * 009-indicators-reports, T019 — the two Risk-sourced
 * `ScopedIndicatorMetricProvider`s (`RISK_TOTAL_BY_LEVEL`,
 * `RISK_TREATMENT_OVERDUE_COUNT`). Both delegate to
 * `RiskDashboardMetricsPort` (`shared/grc-ports/risk-dashboard-metrics.port.ts`),
 * which itself delegates to the SAME `DashboardQueryPort.getRiskProfile`/
 * `getTreatmentActionsSummary` `GET /dashboard` already calls
 * (research.md D-4) — no query of this file's own.
 *
 * Only `IndicatorCalculationService` (T029) ever constructs/injects these
 * — see that file's own header for how registration keeps them
 * unreachable from anywhere else.
 */
import { Injectable } from '@nestjs/common';

import { RiskDashboardMetricsPort } from '../../../../shared/grc-ports/risk-dashboard-metrics.port';

import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  IndicatorMetricValue,
  ScopedIndicatorMetricProvider,
} from '../../domain/indicator-metric-provider';

@Injectable()
export class RiskTotalByLevelProvider implements ScopedIndicatorMetricProvider {
  readonly metricKey = 'RISK_TOTAL_BY_LEVEL' as const;

  constructor(private readonly riskDashboardMetrics: RiskDashboardMetricsPort) {}

  async computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue> {
    const byLevel = await this.riskDashboardMetrics.getRiskCountByResidualLevel(scope);
    return { shape: 'BY_BUCKET', valueByBucket: byLevel };
  }
}

@Injectable()
export class RiskTreatmentOverdueCountProvider implements ScopedIndicatorMetricProvider {
  readonly metricKey = 'RISK_TREATMENT_OVERDUE_COUNT' as const;

  constructor(private readonly riskDashboardMetrics: RiskDashboardMetricsPort) {}

  async computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue> {
    const overdue = await this.riskDashboardMetrics.getOverdueTreatmentActionCount(scope);
    return { shape: 'SINGLE_VALUE', value: overdue };
  }
}
