/**
 * 009-indicators-reports, T027 — the sole implementation of
 * `IncidentMetricsPort` (`shared/grc-ports/incident-metrics.port.ts`).
 * Delegates to `PrismaIncidentRepository.list` — the SAME catalog query
 * `GET /incidents` already runs — once per `IncidentSeverity` value (each
 * call's own `status` filter narrowed to `OPEN_INCIDENT_STATUSES`,
 * `pageSize: 1`), reading only each page's own `total`. Four small,
 * indexed calls, run in parallel — never a fifth, hand-rolled aggregate
 * query.
 */
import { Injectable } from '@nestjs/common';

import { IncidentMetricsPort } from '../../../shared/grc-ports/incident-metrics.port';
import { OPEN_INCIDENT_STATUSES } from '../domain/incident.entity';

import { PrismaIncidentRepository } from './prisma-incident.repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

const INCIDENT_SEVERITIES: readonly IncidentSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

@Injectable()
export class IncidentMetricsAdapter implements IncidentMetricsPort {
  constructor(private readonly incidentRepository: PrismaIncidentRepository) {}

  async getOpenCountBySeverity(
    scope: ScopeFilter,
  ): Promise<Readonly<Record<IncidentSeverity, number>>> {
    const counts = await Promise.all(
      INCIDENT_SEVERITIES.map((severity) =>
        this.incidentRepository
          .list(
            scope,
            { status: OPEN_INCIDENT_STATUSES, severity: [severity] },
            'code',
            'asc',
            1,
            1,
          )
          .then((page) => page.total),
      ),
    );

    return INCIDENT_SEVERITIES.reduce<Record<IncidentSeverity, number>>(
      (byLevel, severity, index) => {
        byLevel[severity] = counts[index] ?? 0;
        return byLevel;
      },
      { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    );
  }

  /**
   * `GET /dashboard/summary`'s `breakdowns.incidents.byStatus` — the SAME
   * pattern as `getOpenCountBySeverity` above (one `list` call per value,
   * `pageSize: 1`, reading only `total`), but over all five
   * `IncidentStatus` values with no `status` filter restricting to the
   * open subset.
   */
  async getCountByStatus(scope: ScopeFilter): Promise<Readonly<Record<IncidentStatus, number>>> {
    const counts = await Promise.all(
      INCIDENT_STATUSES.map((status) =>
        this.incidentRepository
          .list(scope, { status: [status] }, 'code', 'asc', 1, 1)
          .then((page) => page.total),
      ),
    );

    return INCIDENT_STATUSES.reduce<Record<IncidentStatus, number>>(
      (byStatus, status, index) => {
        byStatus[status] = counts[index] ?? 0;
        return byStatus;
      },
      { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0, CANCELLED: 0 },
    );
  }
}
