/**
 * PharosGRC frontend — GRC dashboard types (T198/T199).
 *
 * Hand-written against `specs/001-grc-platform-foundation/contracts/platform.openapi.yaml`'s
 * `Dashboard` schema (~1002) and, precisely, against the actual response
 * shape `apps/api/src/modules/risk/presentation/dto/dashboard-response.mapper.ts`
 * emits — the same "contract + real implementation, not the task sheet's
 * prose" discipline `docs/local-environment.md` D-14/F-18 already
 * establishes. `link` is present on `risks`/`itemsRequiringReview`/
 * `overdueActions` (the mapper always sets it) and deliberately absent from
 * `pendingApprovals`/`treatmentActions` (no register filter reproduces
 * either — see the mapper's own doc comment for why inventing one would be
 * a broken link presented as a working one).
 *
 * Note: the contract's own prose and T197's task line mention breakdowns
 * "by unit" and "by category" — the implemented, committed backend
 * (`get-dashboard.usecase.ts`, `dashboard-response.mapper.ts`) only ever
 * returns `byResidualLevel` and `byStatus`. This file mirrors what the API
 * actually sends, not the aspirational task description.
 */
import type { RiskLevel, RiskStatus, UserRef } from '@/features/risks/types';

export interface DashboardLink {
  readonly path: string;
}

/** One risk surfaced on a dashboard tile (`DashboardRiskItem`, ~1127). Always present, but nullable per-field exactly as the mapper emits — never optional. */
export interface DashboardRiskItem {
  readonly riskId: string;
  readonly code: string;
  readonly title: string;
  readonly residualLevel: RiskLevel | null;
  readonly dueContext: string | null;
}

/** One treatment action surfaced on the overdue-actions tile (`DashboardActionItem`, ~1147). */
export interface DashboardActionItem {
  readonly actionId: string;
  readonly riskId: string;
  readonly riskCode: string;
  readonly title: string;
  /** Date-only (`YYYY-MM-DD`) — format with `formatDateOnly` (`@/features/risks/date`), never `new Date(...).toLocaleDateString()` directly (off-by-one, see that module's own doc comment). */
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

/**
 * Mirrors `Dashboard.plannedAreas` items (~1098). Deliberately `string`, not
 * a closed union of the three keys the backend happens to return today:
 * F-22/T206a found that exact closed-union shape — `PlannedAreaKey` and
 * `PLANNED_AREAS` hardcoded inside `modules/risk/application/get-dashboard.usecase.ts`
 * — to be one of the two things that broke SC-011 ("a new GRC module can be
 * added without changing the shell, `core/` or Risk Management"), and it is
 * being converted to a real registry server-side. Widening this to `string`
 * means this component never needs a matching change when that registry
 * grows: `page.tsx` renders `data.plannedAreas.map(...)` — whatever the
 * array contains, however many entries, with whatever `key`/`label` it
 * carries — never a hardcoded list of the three names it happens to be
 * today.
 */
export type PlannedAreaKey = string;

export interface PlannedArea {
  readonly key: PlannedAreaKey;
  /** Already resolved to pt-BR by the backend (`USER_MESSAGES.dashboard.plannedAreaLabels`) — rendered as-is, never re-translated or duplicated in this catalog (CLAUDE.md §13.8). */
  readonly label: string;
  readonly status: 'PLANNED';
}

/** `GET /dashboard`'s response body (`contracts/platform.openapi.yaml` `Dashboard` schema). */
export interface DashboardResponse {
  readonly risks: DashboardRiskProfile;
  readonly pendingApprovals: DashboardPendingApprovals;
  readonly overdueActions: DashboardOverdueActions;
  readonly itemsRequiringReview: DashboardItemsRequiringReview;
  readonly treatmentActions: DashboardTreatmentActions;
  readonly plannedAreas: readonly PlannedArea[];
}

/**
 * `GET /dashboard/summary` — the platform metric catalogue, evaluated only
 * for the keys whose source-domain read permission the caller holds
 * (`platform.openapi.yaml`'s `DashboardSummary`).
 *
 * `metricKey` is deliberately `string` rather than a closed union restated
 * here. The catalogue is a closed enum on the server and in the contract,
 * and the screen only ever asks for keys it knows by name — restating the
 * eleven values in a third place is exactly the drift `messages/actions.ts`
 * documents having already paid for once with `ActionOriginType`.
 *
 * `value` is optional and its absence is NOT zero: a source with no data at
 * all omits it, and the platform keeps that distinction end to end.
 */
export interface DashboardSummaryMetric {
  readonly metricKey: string;
  readonly shape: 'SINGLE_VALUE' | 'BY_BUCKET';
  readonly scopeApplicability: 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';
  readonly value?: number;
  readonly valueByBucket?: Readonly<Record<string, number>>;
}

export interface DashboardSummaryResponse {
  readonly metrics: readonly DashboardSummaryMetric[];
  /** Optional on the wire for resilience against an older API build — the current contract always sends the object, possibly empty. */
  readonly breakdowns?: DashboardBreakdowns;
}

/**
 * `DashboardSummary.breakdowns` — scoped counts the indicator catalogue does
 * not publish, each exposed by the module that owns the records. A block is
 * ABSENT when the caller lacks that domain's read permission; inside a present
 * block every status/state key is always there, zero-filled.
 */
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
