import { describe, expect, it, vi } from 'vitest';

import { IndicatorMonitoringAdapter } from '../../src/modules/indicators/infrastructure/indicator-monitoring.adapter';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

describe('IndicatorMonitoringAdapter.getMonitoringSummary', () => {
  it('counts only ACTIVE definitions as monitored, and only breached MOST-RECENT measurements as breached', async () => {
    const findManyDefinitions = vi
      .fn()
      .mockResolvedValue([
        { metricKey: 'RISK_TOTAL_BY_LEVEL' },
        { metricKey: 'CONTROL_INACTIVE_COUNT' },
        { metricKey: 'ACTION_OVERDUE_COUNT' },
      ]);
    const findManyMeasurements = vi
      .fn()
      .mockResolvedValue([{ breached: true }, { breached: false }]);
    const prisma = {
      client: {
        indicatorDefinition: { findMany: findManyDefinitions },
        indicatorMeasurement: { findMany: findManyMeasurements },
      },
    } as unknown as PrismaService;
    const adapter = new IndicatorMonitoringAdapter(prisma);

    const result = await adapter.getMonitoringSummary();

    expect(result).toEqual({ monitored: 3, breached: 1 });
    expect(findManyDefinitions).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('never queries measurements — and returns { monitored: 0, breached: 0 } — when there are no active definitions', async () => {
    const findManyDefinitions = vi.fn().mockResolvedValue([]);
    const findManyMeasurements = vi.fn();
    const prisma = {
      client: {
        indicatorDefinition: { findMany: findManyDefinitions },
        indicatorMeasurement: { findMany: findManyMeasurements },
      },
    } as unknown as PrismaService;
    const adapter = new IndicatorMonitoringAdapter(prisma);

    const result = await adapter.getMonitoringSummary();

    expect(result).toEqual({ monitored: 0, breached: 0 });
    expect(findManyMeasurements).not.toHaveBeenCalled();
  });

  it('a definition with no measurement at all does not count as breached', async () => {
    const findManyDefinitions = vi.fn().mockResolvedValue([{ metricKey: 'RISK_TOTAL_BY_LEVEL' }]);
    const findManyMeasurements = vi.fn().mockResolvedValue([]);
    const prisma = {
      client: {
        indicatorDefinition: { findMany: findManyDefinitions },
        indicatorMeasurement: { findMany: findManyMeasurements },
      },
    } as unknown as PrismaService;
    const adapter = new IndicatorMonitoringAdapter(prisma);

    const result = await adapter.getMonitoringSummary();

    expect(result).toEqual({ monitored: 1, breached: 0 });
  });
});
