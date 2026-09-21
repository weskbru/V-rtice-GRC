/**
 * The sole implementation of `IndicatorMonitoringPort`
 * (`shared/grc-ports/indicator-monitoring.port.ts`). Self-contained,
 * Prisma-backed adapter mirroring `OrganizationComplianceSummaryAdapter`'s
 * own shape (`modules/compliance/infrastructure/
 * organization-compliance-summary.adapter.ts`): a fresh set of reads
 * against this module's own tables, rather than reusing
 * `IndicatorDefinitionRepositoryPort`/`IndicatorMeasurementRepositoryPort`
 * — both are providers of `IndicatorsModule` itself, and only the first is
 * exported; reusing them here would still leave this port needing its own
 * tiny wiring module (`indicator-monitoring.module.ts`) to avoid
 * `modules/dashboard` importing the entire `IndicatorsModule` graph for a
 * single read, so a direct `PrismaService` read is the simpler, equally
 * self-contained choice — the same trade-off that adapter's own header
 * documents making.
 *
 * Two reads, never a per-definition round trip:
 *
 *   1. every ACTIVE `IndicatorDefinition`'s `metricKey`;
 *   2. for those keys, the single MOST RECENT `IndicatorMeasurement` per
 *      `metricKey` — `orderBy: [{ metricKey: 'asc' }, { computedAt: 'desc'
 *      }]` + `distinct: ['metricKey']`, the same "latest row per group"
 *      Prisma idiom `PrismaFindingRepository`/
 *      `RiskTreatmentActionRepository` already use `distinct` for
 *      elsewhere in this codebase (though neither combines it with
 *      `orderBy` for a "latest" read the way this query does) — backed by
 *      the table's own `@@index([metricKey, computedAt])`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IndicatorMonitoringPort } from '../../../shared/grc-ports/indicator-monitoring.port';

import type { IndicatorMonitoringSummary } from '../../../shared/grc-ports/indicator-monitoring.port';

@Injectable()
export class IndicatorMonitoringAdapter implements IndicatorMonitoringPort {
  constructor(private readonly prisma: PrismaService) {}

  async getMonitoringSummary(): Promise<IndicatorMonitoringSummary> {
    const activeDefinitions = await this.prisma.client.indicatorDefinition.findMany({
      where: { isActive: true },
      select: { metricKey: true },
    });
    const monitored = activeDefinitions.length;
    if (monitored === 0) {
      return { monitored: 0, breached: 0 };
    }

    const metricKeys = activeDefinitions.map((definition) => definition.metricKey);
    const latestMeasurements = await this.prisma.client.indicatorMeasurement.findMany({
      where: { metricKey: { in: metricKeys } },
      orderBy: [{ metricKey: 'asc' }, { computedAt: 'desc' }],
      distinct: ['metricKey'],
      select: { breached: true },
    });

    const breached = latestMeasurements.filter((measurement) => measurement.breached).length;
    return { monitored, breached };
  }
}
