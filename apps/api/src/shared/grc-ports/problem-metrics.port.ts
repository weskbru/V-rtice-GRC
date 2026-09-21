/**
 * 009-indicators-reports, T028 (research.md D-4) — the boundary port
 * between `modules/indicators` and `modules/problems` for
 * `PROBLEM_OPEN_COUNT_BY_SEVERITY`. `Problem` is a business-module domain
 * (ADR-016), so this is a module-to-module boundary — the same reasoning
 * `problem-risk-link-read.port.ts` documents for its own owning module.
 */
import type { ScopeFilter } from '../persistence/scope-filter';
import type { ProblemSeverity, ProblemStatus } from '@prisma/client';

export abstract class ProblemMetricsPort {
  /** Count of problems whose `status` is one of `OPEN_PROBLEM_STATUSES`
   * (`problem-lifecycle.ts`), grouped by `severity` — zero-filled, every
   * `ProblemSeverity` always a key — within `scope`, filtered on
   * `problems.org_unit_id` itself, never a join. */
  abstract getOpenCountBySeverity(
    scope: ScopeFilter,
  ): Promise<Readonly<Record<ProblemSeverity, number>>>;

  /**
   * `GET /dashboard/summary`'s `breakdowns.problems.byStatus` — count of
   * EVERY problem, grouped by `status` (all five values, unlike
   * `getOpenCountBySeverity` above, which only counts the open subset) —
   * zero-filled, within `scope`, filtered on `problems.org_unit_id`
   * itself, never a join.
   */
  abstract getCountByStatus(scope: ScopeFilter): Promise<Readonly<Record<ProblemStatus, number>>>;
}
