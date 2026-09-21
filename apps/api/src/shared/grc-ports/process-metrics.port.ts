/**
 * 009-indicators-reports, T025 (research.md D-4) — the boundary port
 * between `modules/indicators` and `modules/processes` for
 * `PROCESS_INACTIVE_COUNT`. Mirrors `process-directory.port.ts`'s own
 * reasoning for living here (`Process` is a business-module domain,
 * ADR-016).
 */
import type { ScopeFilter } from '../persistence/scope-filter';

export abstract class ProcessMetricsPort {
  /** Count of processes with `isActive: false`, within `scope`, filtered
   * on `processes.org_unit_id` itself — never a join. */
  abstract getInactiveCount(scope: ScopeFilter): Promise<number>;
}
