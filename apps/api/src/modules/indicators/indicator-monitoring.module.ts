/**
 * Composition-root wiring for `IndicatorMonitoringPort`, mirroring
 * `incident-metrics.module.ts`'s shape (that file's own header): a tiny
 * module binding its OWN `PrismaService`-backed adapter, never
 * `IndicatorsModule` itself, so `modules/dashboard` reaches exactly one
 * port without importing `IndicatorsModule`'s controllers/use cases for a
 * capability `IndicatorsModule` does not otherwise need.
 *
 * Deliberately NOT `@Global()`: `DashboardSummaryModule` imports this
 * module directly to reach `IndicatorMonitoringPort`, rather than relying
 * on global provider visibility that only holds when something else has
 * already imported this module into the same graph — a partial Nest test
 * context would otherwise fail to resolve the port (CLAUDE.md §19.10).
 *
 * `IndicatorsModule` itself does NOT import this module — nothing under
 * `modules/indicators/**` needs `IndicatorMonitoringPort` (it already
 * reads its own tables directly); this module exists solely for the
 * cross-module boundary `modules/dashboard` needs.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IndicatorMonitoringPort } from '../../shared/grc-ports/indicator-monitoring.port';

import { IndicatorMonitoringAdapter } from './infrastructure/indicator-monitoring.adapter';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: IndicatorMonitoringPort, useClass: IndicatorMonitoringAdapter }],
  exports: [IndicatorMonitoringPort],
})
export class IndicatorMonitoringModule {}
