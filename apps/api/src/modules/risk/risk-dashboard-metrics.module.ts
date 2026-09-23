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
