import { Injectable } from '@nestjs/common';

import { RiskDashboardMetricsPort } from '../../../shared/grc-ports/risk-dashboard-metrics.port';

import { DashboardQueryService } from './dashboard-query.service';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { RiskLevel } from '@prisma/client';

@Injectable()
export class RiskDashboardMetricsAdapter implements RiskDashboardMetricsPort {
  constructor(private readonly dashboardQuery: DashboardQueryService) {}

  async getRiskCountByResidualLevel(
    scope: ScopeFilter,
  ): Promise<Readonly<Record<RiskLevel, number>>> {
    const profile = await this.dashboardQuery.getRiskProfile(scope);
    return profile.byResidualLevel;
  }

  async getOverdueTreatmentActionCount(scope: ScopeFilter): Promise<number> {
    const summary = await this.dashboardQuery.getTreatmentActionsSummary(scope);
    return summary.overdue;
  }
}
