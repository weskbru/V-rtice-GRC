/**
 * 009-indicators-reports, T022 — `AUDIT_ENGAGEMENT_OPEN_COUNT`. Delegates
 * to `AuditEngagementMetricsPort`
 * (`shared/grc-ports/audit-engagement-metrics.port.ts`), which itself
 * reuses `PrismaAuditEngagementRepository.list` — no query of this file's
 * own.
 */
import { Injectable } from '@nestjs/common';

import { AuditEngagementMetricsPort } from '../../../../shared/grc-ports/audit-engagement-metrics.port';

import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  IndicatorMetricValue,
  ScopedIndicatorMetricProvider,
} from '../../domain/indicator-metric-provider';

@Injectable()
export class AuditEngagementOpenCountProvider implements ScopedIndicatorMetricProvider {
  readonly metricKey = 'AUDIT_ENGAGEMENT_OPEN_COUNT' as const;

  constructor(private readonly auditEngagementMetrics: AuditEngagementMetricsPort) {}

  async computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue> {
    const openCount = await this.auditEngagementMetrics.getOpenCount(scope);
    return { shape: 'SINGLE_VALUE', value: openCount };
  }
}
