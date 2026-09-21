/**
 * 009-indicators-reports, T027 — `INCIDENT_OPEN_COUNT_BY_SEVERITY`.
 * Delegates to `IncidentMetricsPort`
 * (`shared/grc-ports/incident-metrics.port.ts`), which itself reuses
 * `PrismaIncidentRepository.list` — no query of this file's own.
 */
import { Injectable } from '@nestjs/common';

import { IncidentMetricsPort } from '../../../../shared/grc-ports/incident-metrics.port';

import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  IndicatorMetricValue,
  ScopedIndicatorMetricProvider,
} from '../../domain/indicator-metric-provider';

@Injectable()
export class IncidentOpenCountBySeverityProvider implements ScopedIndicatorMetricProvider {
  readonly metricKey = 'INCIDENT_OPEN_COUNT_BY_SEVERITY' as const;

  constructor(private readonly incidentMetrics: IncidentMetricsPort) {}

  async computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue> {
    const bySeverity = await this.incidentMetrics.getOpenCountBySeverity(scope);
    return { shape: 'BY_BUCKET', valueByBucket: bySeverity };
  }
}
