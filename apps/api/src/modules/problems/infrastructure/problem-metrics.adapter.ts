import { Injectable } from '@nestjs/common';

import { ProblemMetricsPort } from '../../../shared/grc-ports/problem-metrics.port';
import { OPEN_PROBLEM_STATUSES } from '../domain/problem-lifecycle';

import { PrismaProblemRepository } from './prisma-problem.repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ProblemSeverity, ProblemStatus } from '@prisma/client';

const PROBLEM_SEVERITIES: readonly ProblemSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const PROBLEM_STATUSES: readonly ProblemStatus[] = [
  'OPEN',
  'IN_ANALYSIS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

@Injectable()
export class ProblemMetricsAdapter implements ProblemMetricsPort {
  constructor(private readonly problemRepository: PrismaProblemRepository) {}

  async getOpenCountBySeverity(
    scope: ScopeFilter,
  ): Promise<Readonly<Record<ProblemSeverity, number>>> {
    const counts = await Promise.all(
      PROBLEM_SEVERITIES.map((severity) =>
        this.problemRepository
          .list(scope, { status: OPEN_PROBLEM_STATUSES, severity: [severity] }, 1, 1, 'code', 'asc')
          .then((page) => page.total),
      ),
    );

    return PROBLEM_SEVERITIES.reduce<Record<ProblemSeverity, number>>(
      (byLevel, severity, index) => {
        byLevel[severity] = counts[index] ?? 0;
        return byLevel;
      },
      { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    );
  }

  async getCountByStatus(scope: ScopeFilter): Promise<Readonly<Record<ProblemStatus, number>>> {
    const counts = await Promise.all(
      PROBLEM_STATUSES.map((status) =>
        this.problemRepository
          .list(scope, { status: [status] }, 1, 1, 'code', 'asc')
          .then((page) => page.total),
      ),
    );

    return PROBLEM_STATUSES.reduce<Record<ProblemStatus, number>>(
      (byStatus, status, index) => {
        byStatus[status] = counts[index] ?? 0;
        return byStatus;
      },
      { OPEN: 0, IN_ANALYSIS: 0, RESOLVED: 0, CLOSED: 0, CANCELLED: 0 },
    );
  }
}
