/**
 * T197 — port for the GRC dashboard's Risk Management aggregates
 * (`contracts/platform.openapi.yaml`'s `getDashboard` operation, ~414,
 * FR-047 to FR-052). `GetDashboardUseCase`
 * (`application/get-dashboard.usecase.ts`) depends on this abstract class,
 * never on the Prisma-backed `DashboardQueryService` directly (ADR-011,
 * the same discipline `RiskQueryPort` already establishes for the
 * register).
 *
 * Every method takes `scope: ScopeFilter` as a required, non-optional
 * parameter — exactly `RiskQueryPort.listRegister`'s own guarantee
 * (ADR-004, FR-025, FR-090): there is no overload of any method here that
 * omits scope, so a caller cannot forget it.
 *
 * `modules/risk/infrastructure/dashboard-query.service.ts` is the only
 * implementation, wired in `risk.module.ts`.
 */
import type { UserRefRecord } from './risk-repository.port';
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { RiskLevel, RiskStatus } from '@prisma/client';

/** One risk surfaced on a dashboard tile (`DashboardRiskItem`,
 * `contracts/platform.openapi.yaml` ~1127) — used by both the pending-
 * approvals and items-requiring-review areas. */
export interface DashboardRiskItemRecord {
  readonly riskId: string;
  readonly code: string;
  readonly title: string;
  /** Derived by the platform (ADR-006); `undefined` for a risk never
   * assessed. Never accepted as input anywhere. */
  readonly residualLevel: RiskLevel | undefined;
  /** Why the item is listed — an already-resolved, pt-BR sentence
   * (`USER_MESSAGES.risk.dashboard`/`USER_MESSAGES.risk.history`), never
   * built in the presentation layer. */
  readonly dueContext: string | undefined;
}

/** One treatment action surfaced on the overdue-actions tile
 * (`DashboardActionItem`, `contracts/platform.openapi.yaml` ~1147). */
export interface DashboardActionItemRecord {
  readonly actionId: string;
  readonly riskId: string;
  readonly riskCode: string;
  readonly title: string;
  readonly dueOn: Date;
  readonly responsible: UserRefRecord;
}

/** `Dashboard.risks` (FR-049) — the risk profile inside the caller's
 * authorized scope. `byResidualLevel`/`byStatus` always carry every enum
 * member as a key (zero-filled), never only the levels/statuses that
 * happen to have a match — a stable shape the frontend can render without
 * a presence check per key. */
export interface RiskProfileRecord {
  readonly total: number;
  readonly byResidualLevel: Readonly<Record<RiskLevel, number>>;
  readonly byStatus: Readonly<Record<RiskStatus, number>>;
}

export interface PendingApprovalsRecord {
  readonly total: number;
  /** Newest-requested first, capped at `limit` (contract: `maxItems: 10`). */
  readonly items: readonly DashboardRiskItemRecord[];
}

export interface ItemsRequiringReviewRecord {
  readonly total: number;
  /** Most overdue first, capped at `limit`. */
  readonly items: readonly DashboardRiskItemRecord[];
}

export interface OverdueActionsRecord {
  readonly total: number;
  /** Most overdue first, capped at `limit`. */
  readonly items: readonly DashboardActionItemRecord[];
}

/** `Dashboard.treatmentActions` (FR-048/FR-074c) — `open` is `OPEN` +
 * `IN_PROGRESS` (not yet `COMPLETED`/`CANCELLED`); `overdue` is the SAME
 * FR-074b predicate `domain/risk-overdue.ts`'s `isOverdueTreatmentAction`
 * evaluates per-action, aggregated here. */
export interface TreatmentActionsSummaryRecord {
  readonly total: number;
  readonly open: number;
  readonly overdue: number;
}

export abstract class DashboardQueryPort {
  /** `Dashboard.risks` — FR-049. */
  abstract getRiskProfile(scope: ScopeFilter): Promise<RiskProfileRecord>;

  /** `Dashboard.pendingApprovals` — FR-029a, US6 AS8. `excludingUserId` is
   * the caller: a request they themselves made never appears, matching the
   * segregation-of-duties rule `domain/approval.ts` enforces on decision. */
  abstract getPendingApprovals(
    scope: ScopeFilter,
    excludingUserId: string,
    limit: number,
  ): Promise<PendingApprovalsRecord>;

  /** `Dashboard.overdueActions` — FR-074b, FR-075. */
  abstract getOverdueActions(scope: ScopeFilter, limit: number): Promise<OverdueActionsRecord>;

  /** `Dashboard.itemsRequiringReview` — FR-070. */
  abstract getItemsRequiringReview(
    scope: ScopeFilter,
    limit: number,
  ): Promise<ItemsRequiringReviewRecord>;

  /** `Dashboard.treatmentActions` — FR-048, FR-074c. */
  abstract getTreatmentActionsSummary(scope: ScopeFilter): Promise<TreatmentActionsSummaryRecord>;
}
