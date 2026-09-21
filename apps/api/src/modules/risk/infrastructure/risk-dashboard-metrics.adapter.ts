/**
 * 009-indicators-reports, T019 — the sole implementation of
 * `RiskDashboardMetricsPort` (`shared/grc-ports/risk-dashboard-metrics.port.ts`).
 * Pure delegation: both methods call straight through to the SAME
 * `DashboardQueryService` instance `GET /dashboard` already uses (T197),
 * never a second query — see the port's own header for why this
 * indirection exists at all (module boundary, not a new capability).
 */
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
