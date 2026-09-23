import type { UserRefRecord } from './risk-repository.port';
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { RiskLevel, RiskStatus } from '@prisma/client';

export interface DashboardRiskItemRecord {
  readonly riskId: string;
  readonly code: string;
  readonly title: string;
  readonly residualLevel: RiskLevel | undefined;
  readonly dueContext: string | undefined;
}

export interface DashboardActionItemRecord {
  readonly actionId: string;
  readonly riskId: string;
  readonly riskCode: string;
  readonly title: string;
  readonly dueOn: Date;
  readonly responsible: UserRefRecord;
}

export interface RiskProfileRecord {
  readonly total: number;
  readonly byResidualLevel: Readonly<Record<RiskLevel, number>>;
  readonly byStatus: Readonly<Record<RiskStatus, number>>;
}

export interface PendingApprovalsRecord {
  readonly total: number;
  readonly items: readonly DashboardRiskItemRecord[];
}

export interface ItemsRequiringReviewRecord {
  readonly total: number;
  readonly items: readonly DashboardRiskItemRecord[];
}

export interface OverdueActionsRecord {
  readonly total: number;
  readonly items: readonly DashboardActionItemRecord[];
}

export interface TreatmentActionsSummaryRecord {
  readonly total: number;
  readonly open: number;
  readonly overdue: number;
}

export abstract class DashboardQueryPort {
  abstract getRiskProfile(scope: ScopeFilter): Promise<RiskProfileRecord>;

  abstract getPendingApprovals(
    scope: ScopeFilter,
    excludingUserId: string,
    limit: number,
  ): Promise<PendingApprovalsRecord>;

  abstract getOverdueActions(scope: ScopeFilter, limit: number): Promise<OverdueActionsRecord>;

  abstract getItemsRequiringReview(
    scope: ScopeFilter,
    limit: number,
  ): Promise<ItemsRequiringReviewRecord>;

  abstract getTreatmentActionsSummary(scope: ScopeFilter): Promise<TreatmentActionsSummaryRecord>;
}
