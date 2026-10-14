import type { DashboardOutput } from '../../application/get-dashboard.usecase';
import type {
  DashboardActionItemRecord,
  DashboardRiskItemRecord,
} from '../../domain/ports/dashboard-query.port';
import type { RiskLevel, RiskStatus } from '@prisma/client';

export interface DashboardLinkResponse {
  readonly path: string;
}

export interface DashboardRiskItemResponse {
  readonly riskId: string;
  readonly code: string;
  readonly title: string;
  readonly residualLevel: RiskLevel | null;
  readonly dueContext: string | null;
}

export interface DashboardActionItemResponse {
  readonly actionId: string;
  readonly riskId: string;
  readonly riskCode: string;
  readonly title: string;
  readonly dueOn: string;
  readonly responsible: { readonly id: string; readonly fullName: string; readonly email: string };
}

export interface PlannedAreaResponse {
  readonly key: string;
  readonly label: string;
  readonly status: 'PLANNED';
}

export interface DashboardResponse {
  readonly risks: {
    readonly total: number;
    readonly byResidualLevel: Readonly<Record<RiskLevel, number>>;
    readonly byStatus: Readonly<Record<RiskStatus, number>>;
    readonly link: DashboardLinkResponse;
  };
  readonly pendingApprovals: {
    readonly total: number;
    readonly items: readonly DashboardRiskItemResponse[];
  };
  readonly overdueActions: {
    readonly total: number;
    readonly items: readonly DashboardActionItemResponse[];
    readonly link: DashboardLinkResponse;
  };
  readonly itemsRequiringReview: {
    readonly total: number;
    readonly items: readonly DashboardRiskItemResponse[];
    readonly link: DashboardLinkResponse;
  };
  readonly treatmentActions: {
    readonly total: number;
    readonly open: number;
    readonly overdue: number;
  };
  readonly plannedAreas: readonly PlannedAreaResponse[];
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toRiskItemResponse(record: DashboardRiskItemRecord): DashboardRiskItemResponse {
  return {
    riskId: record.riskId,
    code: record.code,
    title: record.title,
    residualLevel: record.residualLevel ?? null,
    dueContext: record.dueContext ?? null,
  };
}

function toActionItemResponse(record: DashboardActionItemRecord): DashboardActionItemResponse {
  return {
    actionId: record.actionId,
    riskId: record.riskId,
    riskCode: record.riskCode,
    title: record.title,
    dueOn: toDateOnlyString(record.dueOn),
    responsible: {
      id: record.responsible.id,
      fullName: record.responsible.fullName,
      email: record.responsible.email,
    },
  };
}

export function toDashboardResponse(output: DashboardOutput): DashboardResponse {
  return {
    risks: {
      total: output.risks.total,
      byResidualLevel: output.risks.byResidualLevel,
      byStatus: output.risks.byStatus,
      link: { path: '/risks' },
    },
    pendingApprovals: {
      total: output.pendingApprovals.total,
      items: output.pendingApprovals.items.map(toRiskItemResponse),
    },
    overdueActions: {
      total: output.overdueActions.total,
      items: output.overdueActions.items.map(toActionItemResponse),
      link: { path: '/risks?overdueTreatment=true' },
    },
    itemsRequiringReview: {
      total: output.itemsRequiringReview.total,
      items: output.itemsRequiringReview.items.map(toRiskItemResponse),
      link: { path: '/risks?overdueReview=true' },
    },
    treatmentActions: {
      total: output.treatmentActions.total,
      open: output.treatmentActions.open,
      overdue: output.treatmentActions.overdue,
    },
    plannedAreas: output.plannedAreas.map((area) => ({
      key: area.key,
      label: area.label,
      status: area.status,
    })),
  };
}
