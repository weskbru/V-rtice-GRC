/**
 * T105/T106 — port for the risk register's read model
 * (`contracts/risks.openapi.yaml`'s `GET /risks`, US3/FR-086 to FR-091).
 * `ListRisksUseCase` (`application/list-risks.usecase.ts`, T106) depends on
 * this abstract class, never on the Prisma-backed `RiskQueryService`
 * directly (ADR-011: `module-application` may not import
 * `module-infrastructure`) — the same discipline `RiskRepositoryPort`
 * already establishes for T088.
 *
 * `modules/risk/infrastructure/risk-query.service.ts` is the only
 * implementation, wired in `risk.module.ts`.
 *
 * `scope: ScopeFilter` is a required, non-optional parameter on
 * `listRegister` — exactly the `ScopedRepository` guarantee (ADR-004,
 * FR-025, FR-090) applied here even though this port does not extend
 * `ScopedRepository` itself (that base is shaped around a single Prisma
 * `WhereInput` object; the register's combined filter/search/sort query
 * is raw SQL — see the implementation's header for why). There is no
 * overload of `listRegister` that omits `scope`.
 */
import type {
  OrgUnitRefRecord,
  ReferenceDataRefRecord,
  UserRefRecord,
} from './risk-repository.port';
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { RiskLevel, RiskStatus } from '@prisma/client';

/** ADR-006: "risk level" in the register is ambiguous between inherent and
 * residual; `riskLevelBasis` names which one `riskLevel` filtering/sorting
 * applies to. Defaults to `RESIDUAL` — "the exposure that remains after
 * controls", the level a risk manager acts on. */
export type RiskLevelBasis = 'RESIDUAL' | 'INHERENT';

/** FR-087's six required sort fields, plus `identifiedOn` and `updatedAt`
 * (`contracts/risks.openapi.yaml`'s `sort` enum). */
export type RiskRegisterSortField =
  | 'code'
  | 'title'
  | 'riskLevel'
  | 'status'
  | 'owner'
  | 'nextReviewOn'
  | 'identifiedOn'
  | 'updatedAt';

export type RiskRegisterSortDirection = 'asc' | 'desc';

export interface RiskRegisterFilters {
  /** FR-089 — text search across code, title and description. `undefined`/
   * empty means no search restriction. */
  readonly q?: string | undefined;
  /** FR-088 — lifecycle statuses to include (OR within the filter, AND
   * with every other filter). */
  readonly status?: readonly RiskStatus[] | undefined;
  /** FR-088 — risk levels to include, applied to `riskLevelBasis`. */
  readonly riskLevel?: readonly RiskLevel[] | undefined;
  readonly riskLevelBasis: RiskLevelBasis;
  /** FR-088 — categories to include. */
  readonly categoryId?: readonly string[] | undefined;
  /** FR-088/FR-025b — organizational units to include. ALWAYS intersected
   * with `scope` by the implementation — this narrows the caller's scope,
   * it never widens it (`contracts/risks.openapi.yaml`'s `orgUnitId`
   * parameter description). */
  readonly orgUnitId?: readonly string[] | undefined;
  /** Whether `orgUnitId` also matches descendant units (FR-025b). Only
   * meaningful when `orgUnitId` is supplied. */
  readonly includeDescendants: boolean;
  /** FR-088 — owners to include. */
  readonly ownerUserId?: readonly string[] | undefined;
  /** FR-070/FR-091 — restrict to risks whose `nextReviewOn` has passed,
   * computed on read (ADR-015: no async job). `undefined`/`false` applies
   * no restriction. */
  readonly overdueReview?: boolean | undefined;
  /** FR-074b/FR-075 — restrict to risks with an overdue treatment
   * condition: at least one treatment action whose due date has passed
   * while its status is not `COMPLETED`/`CANCELLED` (T141, ADR-015). See
   * the implementation's header for the shared `EXISTS` fragment this and
   * `RiskRegisterRow.overdueTreatment` are both built from. */
  readonly overdueTreatment?: boolean | undefined;
}

export interface RiskRegisterSort {
  readonly field: RiskRegisterSortField;
  readonly direction: RiskRegisterSortDirection;
}

export interface RiskRegisterQuery {
  readonly scope: ScopeFilter;
  readonly filters: RiskRegisterFilters;
  readonly sort: RiskRegisterSort;
  /** Already validated/capped by the presentation-layer DTO; the
   * implementation re-clamps via `shared/pagination` regardless (defense
   * in depth — FR-086 "no endpoint returns an unbounded result set" is a
   * server-enforced cap, not a client-trusted one). */
  readonly page: number;
  readonly pageSize: number;
}

/** One register row — `contracts/risks.openapi.yaml`'s `RiskSummary`,
 * exactly as the presentation layer's mapper needs it (every relation
 * already resolved, matching `RiskRecord`'s own convention). */
export interface RiskRegisterRow {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  /** The first 200 characters of the risk's description, for list previews
   * only (`contracts/risks.openapi.yaml`'s `RiskSummary.descriptionExcerpt`).
   * The full text is on `RiskRecord.description`. */
  readonly descriptionExcerpt: string | null;
  readonly status: RiskStatus;
  readonly category: ReferenceDataRefRecord | undefined;
  readonly orgUnit: OrgUnitRefRecord;
  readonly owner: UserRefRecord;
  readonly responsible: UserRefRecord | undefined;
  readonly inherentScore: number | undefined;
  readonly inherentLevel: RiskLevel | undefined;
  readonly residualScore: number | undefined;
  readonly residualLevel: RiskLevel | undefined;
  readonly lastAssessedOn: Date | undefined;
  readonly nextReviewOn: Date | undefined;
  /** Computed on read from `nextReviewOn` (FR-070, FR-091). */
  readonly overdueReview: boolean;
  /** Computed on read from `risk_treatment_actions` (FR-074b, T141,
   * ADR-015) — see the implementation's header for the shared predicate
   * this and the `overdueTreatment` filter are both built from. */
  readonly overdueTreatment: boolean;
  readonly pendingApproval: boolean;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface RiskRegisterPage {
  readonly items: readonly RiskRegisterRow[];
  readonly total: number;
}

export abstract class RiskQueryPort {
  abstract listRegister(query: RiskRegisterQuery): Promise<RiskRegisterPage>;
}
