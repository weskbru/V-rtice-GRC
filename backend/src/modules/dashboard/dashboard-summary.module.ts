import { Module } from '@nestjs/common';

import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { ActionModule } from '../../grc/action/action.module';
import { IndicatorCalculationPort } from '../../shared/grc-ports/indicator-calculation.port';
import { ComplianceSummaryModule } from '../compliance/compliance-summary.module';
import { ControlMetricsModule } from '../controls/control-metrics.module';
import { IncidentMetricsModule } from '../incidents/incident-metrics.module';
import { IndicatorCalculationService } from '../indicators/application/indicator-calculation.service';
import { getIndicatorMetricCatalogEntry } from '../indicators/domain/indicator-metric-catalog';
import { IndicatorMonitoringModule } from '../indicators/indicator-monitoring.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { ProblemMetricsModule } from '../problems/problem-metrics.module';

import { GetDashboardSummaryUseCase } from './application/get-dashboard-summary.usecase';
import { DashboardSummaryController } from './presentation/dashboard-summary.controller';

import type { IndicatorCalculationPortResult } from '../../shared/grc-ports/indicator-calculation.port';
import type { ScopeFilter } from '../../shared/persistence/scope-filter';
import type { IndicatorMetricKey } from '@prisma/client';

@Module({
  imports: [
    AuthorizationModule,
    OrganizationsModule,
    IndicatorsModule,
    ActionModule,
    IncidentMetricsModule,
    ProblemMetricsModule,
    ControlMetricsModule,
    ComplianceSummaryModule,
    IndicatorMonitoringModule,
  ],
  controllers: [DashboardSummaryController],
  providers: [
    GetDashboardSummaryUseCase,
    {
      provide: IndicatorCalculationPort,
      useFactory: (calculationService: IndicatorCalculationService) => ({
        getMetadata: (metricKey: IndicatorMetricKey) => {
          const entry = getIndicatorMetricCatalogEntry(metricKey);
          return {
            sourcePermission: entry.sourcePermission,
            scopeApplicability: entry.scopeApplicability,
          };
        },
        calculate: (input: {
          metricKey: IndicatorMetricKey;
          scope: ScopeFilter;
        }): Promise<IndicatorCalculationPortResult> =>
          calculationService.calculate({ ...input, definition: undefined }),
      }),
      inject: [IndicatorCalculationService],
    },
  ],
})
export class DashboardSummaryModule {}
