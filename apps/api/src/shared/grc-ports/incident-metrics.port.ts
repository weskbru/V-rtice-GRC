/**
 * 009-indicators-reports, T027 (research.md D-4) — the boundary port
 * between `modules/indicators` and `modules/incidents` for
 * `INCIDENT_OPEN_COUNT_BY_SEVERITY`. `Incident` is a business-module
 * domain (ADR-016), so this is a module-to-module boundary — the same
 * reasoning `incident-directory.port.ts` documents in full.
 */
import type { ScopeFilter } from '../persistence/scope-filter';
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

export abstract class IncidentMetricsPort {
  /** Count of incidents whose `status` is one of
   * `OPEN_INCIDENT_STATUSES` (`incident.entity.ts`), grouped by
   * `severity` — zero-filled, every `IncidentSeverity` always a key —
   * within `scope`, filtered on `incidents.org_unit_id` itself, never a
   * join. */
  abstract getOpenCountBySeverity(
    scope: ScopeFilter,
  ): Promise<Readonly<Record<IncidentSeverity, number>>>;

  /**
   * `GET /dashboard/summary`'s `breakdowns.incidents.byStatus` — count of
   * EVERY incident, grouped by `status` (all five values, unlike
   * `getOpenCountBySeverity` above, which only counts the open subset) —
   * zero-filled, within `scope`, filtered on `incidents.org_unit_id`
   * itself, never a join.
   */
  abstract getCountByStatus(scope: ScopeFilter): Promise<Readonly<Record<IncidentStatus, number>>>;
}
