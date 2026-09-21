/**
 * T197 — maps `DashboardOutput` (`application/get-dashboard.usecase.ts`) to
 * `contracts/platform.openapi.yaml`'s `Dashboard` wire shape (~1002). The
 * ONE place a dashboard aggregate becomes a response body (ADR-009).
 *
 * ## `link` — the register query that reproduces the tile (FR-052)
 *
 * Only set where a REAL, functioning register filter reproduces the tile's
 * exact contents:
 *
 * - `risks` -> `/risks` (the whole scoped register, no filter).
 * - `itemsRequiringReview` -> `/risks?overdueReview=true`
 *   (`contracts/risks.openapi.yaml`'s own filter, identical predicate).
 * - `overdueActions` -> `/risks?overdueTreatment=true` — the closest real
 *   filter: it surfaces the RISKS carrying an overdue action, one level
 *   coarser than the individual actions this tile lists, but it is a real,
 *   working query, not a fabricated one.
 *
 * `pendingApprovals` and `treatmentActions` deliberately carry NO `link`:
 * `link` is optional per area (`Dashboard` schema's `required` list omits
 * it), and there is no register filter for "approvals awaiting me" (the
 * approvals endpoints are per-risk only,
 * `/risks/{riskId}/approvals[/…]`, contracts/risks.openapi.yaml ~1063) or
 * for "has any treatment action regardless of status" (only
 * `overdueTreatment` exists, already the `overdueActions` tile's own link —
 * repeating it here would misleadingly imply this tile's `open` count is
 * also reachable through that same filter, which it is not). Inventing a
 * path neither the register nor any other endpoint actually accepts would
 * be a broken link presented as a working one.
 *
 * `plannedAreas` (F-22 defect 2): `key`/`label`/`status` are copied
 * straight through from `DashboardOutput.plannedAreas` — the label lookup
 * against `shared/messages/user-messages.ts` now happens once, at
 * registration time, inside `core/dashboard/domain/default-planned-areas.ts`,
 * not here on every request keyed by a closed union this file used to own.
 */
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
