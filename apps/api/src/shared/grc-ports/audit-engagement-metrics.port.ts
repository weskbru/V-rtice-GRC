/**
 * 009-indicators-reports, T022 (research.md D-4) — the boundary port
 * between `modules/indicators` and `modules/audit-engagements` for
 * `AUDIT_ENGAGEMENT_OPEN_COUNT`. `AuditEngagement` is a business-module
 * domain (ADR-016), so this is a module-to-module boundary, not a kernel
 * capability — the same reasoning `control-directory.port.ts` documents in
 * full.
 */
import type { ScopeFilter } from '../persistence/scope-filter';

export abstract class AuditEngagementMetricsPort {
  /** Count of engagements whose `status` is `PLANNING` or `IN_PROGRESS`
   * (`OPEN_AUDIT_ENGAGEMENT_STATUSES`, `audit-engagement.entity.ts`),
   * within `scope`, filtered on `audit_engagements.org_unit_id` itself —
   * never a join. */
  abstract getOpenCount(scope: ScopeFilter): Promise<number>;
}
