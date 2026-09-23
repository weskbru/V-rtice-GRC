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

const DASHBOARD_ITEM_LIMIT = 10;

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
      plannedAreas: getPlannedAreas().map((area) => ({
        key: area.key,
        label: area.label,
        status: 'PLANNED' as const,
      })),
    };
  }
}
