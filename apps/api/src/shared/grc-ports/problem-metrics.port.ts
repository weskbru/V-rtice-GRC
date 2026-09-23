import type { ScopeFilter } from '../persistence/scope-filter';
import type { ProblemSeverity, ProblemStatus } from '@prisma/client';

export abstract class ProblemMetricsPort {
  abstract getOpenCountBySeverity(
    scope: ScopeFilter,
  ): Promise<Readonly<Record<ProblemSeverity, number>>>;

  abstract getCountByStatus(scope: ScopeFilter): Promise<Readonly<Record<ProblemStatus, number>>>;
}
