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
