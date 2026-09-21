/**
 * T197 — `GetDashboardUseCase`: the read side of `GET /dashboard`'s Risk
 * Management areas (`contracts/platform.openapi.yaml`'s `getDashboard`
 * operation, ~414, FR-047 to FR-052). No transaction and no audit entry —
 * reads are not audited (ADR-005), matching `ListRisksUseCase`'s own
 * reasoning.
 *
 * ## Permission-filtered areas (FR-049, FR-025, FR-030)
 *
 * The contract is explicit: "a caller without `risk:view` receives zeroed
 * risk areas rather than counts of records they may not see". This use
 * case is therefore the ONE place that decides which areas are real and
 * which are zeroed — `DashboardController` carries `@NoPermissionRequired()`
 * (any authenticated session may call the endpoint at all; there is no
 * permission narrower than "authenticated" that gates the ENDPOINT), and
 * the permission check that actually varies the response happens here,
 * exactly the same pattern `GetRiskLifecycleUseCase` already establishes
 * for filtering `availableTransitions` by the caller's effective
 * permissions rather than a controller-level guard.
 *
 * - `risks`, `itemsRequiringReview`, `overdueActions`, `treatmentActions`
 *   all require `risk:view` — every one of them summarizes risk records the
 *   caller must be able to see individually to make sense of.
 * - `pendingApprovals` additionally requires `risk:approve`: seeing a
 *   pending approval already needs `risk:view` (mirrors
 *   `GET /risks/{riskId}/approvals`'s own gate,
 *   `lifecycle.controller.ts`), and DECIDING one needs `risk:approve`
 *   (`POST .../decision`'s own gate) — the tile's whole point is "requests
 *   THIS CALLER may decide" (FR-029a, US6 AS8), so a caller who could never
 *   decide any approval is shown none, never a count they cannot act on.
 *
 * A zero-permission caller therefore gets every risk-backed area zeroed,
 * `plannedAreas` populated regardless (it carries no metric of any kind —
 * FR-050, SC-013 — so no permission question even arises), and a genuine
 * `200`, never a `403`: this is the exact "authenticated session; no
 * additional permission" contract shape D-11 requires a test to prove for
 * a zero-permission user.
 *
 * ## Scope (ADR-004, FR-025, FR-090)
 *
 * `ScopeResolverService.resolveScope` is called once and its result handed
 * to every populated query, exactly like `ListRisksUseCase` — there is no
 * code path here that queries without a scope.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { getPlannedAreas } from '../../../core/dashboard/domain/planned-area-registry';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { DashboardQueryPort } from '../domain/ports/dashboard-query.port';

import type {
  DashboardActionItemRecord,
  DashboardRiskItemRecord,
} from '../domain/ports/dashboard-query.port';
import type { RiskLevel, RiskStatus } from '@prisma/client';

/** Contract: `maxItems: 10` on every dashboard tile's `items` array. */
const DASHBOARD_ITEM_LIMIT = 10;

/**
 * F-22 defect 2 fix — `key` is no longer a closed union owned by Risk
 * Management (`'PROBLEMS' | 'INCIDENTS' | 'CONTROLS'`): it is whatever a
 * registrant of `core/dashboard/domain/planned-area-registry.ts` supplied.
 * `label` now travels WITH the registry entry (see that file) rather than
 * being looked up here by key against `shared/messages/user-messages.ts` —
 * that lookup was itself a place a future module's key would have needed
 * this file edited to resolve.
 */
export interface PlannedArea {
  readonly key: string;
  readonly label: string;
  readonly status: 'PLANNED';
}

export interface DashboardOutput {
  readonly risks: {
    readonly total: number;
    readonly byResidualLevel: Readonly<Record<RiskLevel, number>>;
    readonly byStatus: Readonly<Record<RiskStatus, number>>;
  };
  readonly pendingApprovals: {
    readonly total: number;
    readonly items: readonly DashboardRiskItemRecord[];
  };
  readonly overdueActions: {
    readonly total: number;
    readonly items: readonly DashboardActionItemRecord[];
  };
  readonly itemsRequiringReview: {
    readonly total: number;
    readonly items: readonly DashboardRiskItemRecord[];
  };
  readonly treatmentActions: {
    readonly total: number;
    readonly open: number;
    readonly overdue: number;
  };
  readonly plannedAreas: readonly PlannedArea[];
}

const ZERO_RISK_PROFILE: DashboardOutput['risks'] = {
  total: 0,
  byResidualLevel: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
  byStatus: {
    DRAFT: 0,
    IDENTIFIED: 0,
    ASSESSED: 0,
    UNDER_TREATMENT: 0,
    UNDER_REVIEW: 0,
    ACCEPTED: 0,
    CLOSED: 0,
    ARCHIVED: 0,
  },
};

export interface GetDashboardInput {
  readonly actorUserId: string;
}

@Injectable()
export class GetDashboardUseCase {
  constructor(
    private readonly dashboardQuery: DashboardQueryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: GetDashboardInput): Promise<DashboardOutput> {
    const [scope, permissions] = await Promise.all([
      this.scopeResolver.resolveScope(input.actorUserId),
      this.permissionResolver.getEffectivePermissions(input.actorUserId),
    ]);

    const canViewRisks = permissions.has('risk:view');
    const canDecideApprovals = canViewRisks && permissions.has('risk:approve');

    const [risks, itemsRequiringReview, overdueActions, treatmentActions, pendingApprovals] =
      await Promise.all([
        canViewRisks ? this.dashboardQuery.getRiskProfile(scope) : Promise.resolve(undefined),
        canViewRisks
          ? this.dashboardQuery.getItemsRequiringReview(scope, DASHBOARD_ITEM_LIMIT)
          : Promise.resolve(undefined),
        canViewRisks
          ? this.dashboardQuery.getOverdueActions(scope, DASHBOARD_ITEM_LIMIT)
          : Promise.resolve(undefined),
        canViewRisks
          ? this.dashboardQuery.getTreatmentActionsSummary(scope)
          : Promise.resolve(undefined),
        canDecideApprovals
          ? this.dashboardQuery.getPendingApprovals(scope, input.actorUserId, DASHBOARD_ITEM_LIMIT)
          : Promise.resolve(undefined),
      ]);

    return {
      risks: risks ?? ZERO_RISK_PROFILE,
      itemsRequiringReview: itemsRequiringReview ?? { total: 0, items: [] },
      overdueActions: overdueActions ?? { total: 0, items: [] },
      treatmentActions: treatmentActions ?? { total: 0, open: 0, overdue: 0 },
      pendingApprovals: pendingApprovals ?? { total: 0, items: [] },
      // FR-050/SC-013: populated regardless of the caller's permissions —
      // a planned area carries no metric of any kind, so no permission
      // question arises. Sourced from the registry (F-22 defect 2), never
      // a literal array owned by Risk Management.
      plannedAreas: getPlannedAreas().map((area) => ({
        key: area.key,
        label: area.label,
        status: 'PLANNED' as const,
      })),
    };
  }
}
