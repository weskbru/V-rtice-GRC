import type { RiskLevel, RiskStatus, UserRef } from '@/features/risks/types';

export interface DashboardLink {
  readonly path: string;
}

export interface DashboardRiskItem {
  readonly riskId: string;
  readonly code: string;
  readonly title: string;
  readonly residualLevel: RiskLevel | null;
  readonly dueContext: string | null;
}

export interface DashboardActionItem {
  readonly actionId: string;
  readonly riskId: string;
  readonly riskCode: string;
  readonly title: string;
  readonly dueOn: string;
  readonly responsible: UserRef;
}

export interface DashboardRiskProfile {
  readonly total: number;
  readonly byResidualLevel: Readonly<Record<RiskLevel, number>>;
  readonly byStatus: Readonly<Record<RiskStatus, number>>;
  readonly link: DashboardLink;
}

export interface DashboardPendingApprovals {
  readonly total: number;
  readonly items: readonly DashboardRiskItem[];
}

export interface DashboardOverdueActions {
  readonly total: number;
  readonly items: readonly DashboardActionItem[];
  readonly link: DashboardLink;
}

export interface DashboardItemsRequiringReview {
  readonly total: number;
  readonly items: readonly DashboardRiskItem[];
  readonly link: DashboardLink;
}

export interface DashboardTreatmentActions {
  readonly total: number;
  readonly open: number;
  readonly overdue: number;
}

export type PlannedAreaKey = string;

export interface PlannedArea {
  readonly key: PlannedAreaKey;
  readonly label: string;
  readonly status: 'PLANNED';
}

export interface DashboardResponse {
  readonly risks: DashboardRiskProfile;
  readonly pendingApprovals: DashboardPendingApprovals;
  readonly overdueActions: DashboardOverdueActions;
  readonly itemsRequiringReview: DashboardItemsRequiringReview;
  readonly treatmentActions: DashboardTreatmentActions;
  readonly plannedAreas: readonly PlannedArea[];
}

export interface DashboardSummaryMetric {
  readonly metricKey: string;
  readonly shape: 'SINGLE_VALUE' | 'BY_BUCKET';
  readonly scopeApplicability: 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';
  readonly value?: number;
  readonly valueByBucket?: Readonly<Record<string, number>>;
}

export interface DashboardSummaryResponse {
  readonly metrics: readonly DashboardSummaryMetric[];
  readonly breakdowns?: DashboardBreakdowns;
}

export interface DashboardBreakdowns {
  readonly actions?: {
    readonly byStatus: Readonly<Record<'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED', number>>;
    readonly dueSoon: number;
    readonly dueSoonWindowDays: number;
  };
  readonly incidents?: {
    readonly byStatus: Readonly<
      Record<'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED', number>
    >;
  };
  readonly problems?: {
    readonly byStatus: Readonly<
      Record<'OPEN' | 'IN_ANALYSIS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED', number>
    >;
  };
  readonly controls?: {
    readonly total: number;
    readonly active: number;
    readonly ineffective: number;
  };
  readonly compliance?: {
    readonly requirementCount: number;
    readonly byState: Readonly<
      Record<'NOT_APPLICABLE' | 'NOT_MET' | 'NOT_PROVEN' | 'PARTIALLY_MET' | 'COMPLIANT', number>
    >;
  };
  readonly indicators?: {
    readonly monitored: number;
    readonly breached: number;
  };
}
