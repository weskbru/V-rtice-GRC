/**
 * 009-indicators-reports, T020 (research.md D-4) — the boundary port
 * between `modules/indicators` and `modules/controls` for
 * `CONTROL_INACTIVE_COUNT`. Mirrors `control-directory.port.ts`'s own
 * reasoning for living here (`Control` is a business-module domain,
 * ADR-016) — see that file's header for the full account this one does
 * not repeat.
 *
 * "Inactive" here means `ControlStatus !== 'ACTIVE'` — `DRAFT`,
 * `SUSPENDED` or `RETIRED` (`schema.prisma`'s own four-value enum). There
 * is no separate `isActive` boolean on `Control` (unlike `Asset`/
 * `Process`) — status IS the lifecycle, so "inactive" is a status set, not
 * a column.
 */
import type { ScopeFilter } from '../persistence/scope-filter';

export interface ControlSummaryCounts {
  /** Every control in `scope`, any status. */
  readonly total: number;
  /** Controls in `scope` whose `status` is `ACTIVE`. */
  readonly active: number;
  /** Controls in `scope` whose `status` is `ACTIVE` AND whose CURRENT
   * derived effectiveness (the SAME `controlEffectivenessExpression` the
   * catalog's own `effectiveness` column/filter/sort already use — never a
   * second computation, CLAUDE.md §19.7) is `INEFFECTIVE`. */
  readonly ineffective: number;
}

export abstract class ControlMetricsPort {
  /** Count of controls whose `status` is `DRAFT`, `SUSPENDED` or
   * `RETIRED` (i.e. not `ACTIVE`), within `scope`, filtered on the
   * `controls.org_unit_id` column itself — never a join. */
  abstract getInactiveCount(scope: ScopeFilter): Promise<number>;

  /**
   * `GET /dashboard/summary`'s `breakdowns.controls` — total, active and
   * ineffective-among-active counts, all within `scope`, filtered on
   * `controls.org_unit_id` itself.
   */
  abstract getSummary(scope: ScopeFilter): Promise<ControlSummaryCounts>;
}
