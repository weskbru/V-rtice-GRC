/**
 * 009-indicators-reports, T019 — composition-root wiring for
 * `RiskDashboardMetricsPort`, mirroring `control-directory.module.ts`/
 * `incident-directory.module.ts`'s shape (a tiny module, not folded into
 * `RiskModule` itself, so `modules/indicators` never imports `RiskModule`'s
 * own controllers/use cases to reach this one port).
 *
 * Binds its OWN `DashboardQueryService` instance (requiring only
 * `PrismaModule`) rather than reusing `RiskModule`'s already-running one —
 * the same self-contained-adapter shape every other boundary port in this
 * codebase already uses (`PrismaControlEffectivenessAdapter`,
 * `PrismaIncidentDirectoryAdapter`). `DashboardQueryService` is stateless
 * (Prisma-backed only), so a second instance carries no risk of drift.
 *
 * Deliberately NOT `@Global()`: `IndicatorsModule` imports this module
 * directly to reach `RiskDashboardMetricsPort`, rather than relying on
 * global provider visibility that only holds when something else has
 * already imported `RiskModule` into the same graph — a partial Nest test
 * context would otherwise fail to resolve the port (CLAUDE.md §19.10).
 * `RiskModule` still imports this module too, so both graphs bind the
 * same port the same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RiskDashboardMetricsPort } from '../../shared/grc-ports/risk-dashboard-metrics.port';

import { DashboardQueryService } from './infrastructure/dashboard-query.service';
import { RiskDashboardMetricsAdapter } from './infrastructure/risk-dashboard-metrics.adapter';

@Module({
  imports: [PrismaModule],
  providers: [
    DashboardQueryService,
    { provide: RiskDashboardMetricsPort, useClass: RiskDashboardMetricsAdapter },
  ],
  exports: [RiskDashboardMetricsPort],
})
export class RiskDashboardMetricsModule {}
