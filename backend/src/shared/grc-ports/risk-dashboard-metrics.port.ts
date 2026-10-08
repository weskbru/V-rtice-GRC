import type { ScopeFilter } from '../persistence/scope-filter';
import type { RiskLevel } from '@prisma/client';

export abstract class RiskDashboardMetricsPort {
  abstract getRiskCountByResidualLevel(
    scope: ScopeFilter,
  ): Promise<Readonly<Record<RiskLevel, number>>>;

  abstract getOverdueTreatmentActionCount(scope: ScopeFilter): Promise<number>;
}
