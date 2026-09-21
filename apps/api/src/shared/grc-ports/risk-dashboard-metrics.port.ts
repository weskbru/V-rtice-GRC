/**
 * 009-indicators-reports, T019 (research.md D-4) — the boundary port
 * between `modules/indicators` and `modules/risk`: `RISK_TOTAL_BY_LEVEL`/
 * `RISK_TREATMENT_OVERDUE_COUNT` reuse the SAME two `DashboardQueryPort`
 * methods `GET /dashboard` already calls
 * (`modules/risk/domain/ports/dashboard-query.port.ts`'s `getRiskProfile`/
 * `getTreatmentActionsSummary`) — never a new risk query. This port exists
 * only because `DashboardQueryPort` itself lives under
 * `modules/risk/domain/**`, and a business module may not import another
 * business module's domain/application layer directly
 * (`apps/api/eslint.config.mjs`'s module-isolation policy) — the identical
 * reason `control-directory.port.ts`/`incident-directory.port.ts` exist for
 * their own owning modules.
 *
 * Lives in `shared/grc-ports/`, not `grc/shared/` — `Risk` is a
 * business-module domain (ADR-016), so this is a module-to-module
 * boundary, not a kernel capability. `shared/**` may not import from
 * `core/**`, `grc/**` or `modules/**`; this file imports only a
 * TYPE-ONLY `@prisma/client` enum (`RiskLevel`) and this same directory's
 * own `ScopeFilter` — the same accepted shape every sibling file here
 * already has.
 *
 * ## Deliberately narrower than `DashboardQueryPort`
 *
 * Only the two methods `009-indicators-reports` actually needs are
 * exposed, each already reduced to the exact projection its consuming
 * provider wants (a bucket map, a single count) — never the full
 * `RiskProfileRecord`/`TreatmentActionsSummaryRecord` shape, which would
 * leak `modules/risk`'s own dashboard-tile modeling (`byStatus`, `open`)
 * across the boundary for fields no indicator key uses.
 */
import type { ScopeFilter } from '../persistence/scope-filter';
import type { RiskLevel } from '@prisma/client';

export abstract class RiskDashboardMetricsPort {
  /** `Dashboard.risks.byResidualLevel` (`DashboardQueryPort.getRiskProfile`),
   * zero-filled — every `RiskLevel` is always a key, even at `0`
   * (data-model.md §2's own "mesmo formato zero-filled"). */
  abstract getRiskCountByResidualLevel(
    scope: ScopeFilter,
  ): Promise<Readonly<Record<RiskLevel, number>>>;

  /** `Dashboard.treatmentActions.overdue`
   * (`DashboardQueryPort.getTreatmentActionsSummary`) — the SAME overdue
   * treatment-action count `GET /dashboard` already surfaces, never a
   * second count. */
  abstract getOverdueTreatmentActionCount(scope: ScopeFilter): Promise<number>;
}
