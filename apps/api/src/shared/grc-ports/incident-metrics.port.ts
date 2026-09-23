import type { ScopeFilter } from '../persistence/scope-filter';
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

export abstract class IncidentMetricsPort {
  abstract getOpenCountBySeverity(
    scope: ScopeFilter,
  ): Promise<Readonly<Record<IncidentSeverity, number>>>;

  abstract getCountByStatus(scope: ScopeFilter): Promise<Readonly<Record<IncidentStatus, number>>>;
}
