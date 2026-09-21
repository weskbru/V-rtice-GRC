/**
 * T048/002-shared-grc-foundation, US2 — `ActionRepositoryPort`
 * (data-model.md §4, ADR-004, ADR-011). `grc/action/application/**` depends
 * on this abstract class, never on `PrismaService` directly. Mirrors
 * `grc/evidence/domain/ports/evidence-repository.port.ts`'s own shape — see
 * that file's header for the reasoning this one does not repeat.
 *
 * `Action` carries no `version` column either (data-model.md §4) — no
 * `If-Match`/`expectedVersion` shape here.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ActionOriginType, ActionStatus } from '@prisma/client';

/**
 * The scope restriction `ListActionUseCase` passes to `list` below — a
 * DELIBERATELY different shape from the single `ScopeFilter` every other
 * scoped method here takes (assurance fix, Fix 1). `Action.orgUnitId` is a
 * creation-time snapshot of the origin's org unit (see this port's own
 * file header and `assert-action-origin-in-scope.ts`) and goes stale the
 * moment the origin moves — `findById`/`update`/`transition` already
 * stopped trusting it (they read unscoped, then re-check the origin's LIVE
 * unit via `assertActionOriginInScope`), but a listing cannot do the same
 * per-row check without turning one query into N+1. `ListActionUseCase`
 * instead resolves, ONCE per list request and per distinct origin type
 * involved, the set of origin ids CURRENTLY inside the actor's scope
 * (`ActionOriginAccessor.listOriginIdsInScope`), and hands the result here
 * as a single `originId IN (...)` predicate per type — `Action.orgUnitId`
 * itself is never consulted for this decision.
 */
export type ActionOriginScopeRestriction =
  | { readonly kind: 'UNRESTRICTED' }
  | {
      readonly kind: 'RESTRICTED';
      /** In-scope origin ids, keyed by `ActionOriginType`. A type present
       * with an EMPTY array means "no origin of this type is currently in
       * scope" (every row of that type is excluded) — never "no
       * restriction for this type" (that would be `UNRESTRICTED` above,
       * decided once for the WHOLE request, not per type: `ScopeFilter`
       * has no partial-GLOBAL case, so neither does this). A type absent
       * from the map was not evaluated (e.g. the caller narrowed the list
       * to a different `originType` filter) and therefore matches nothing.
       */
      readonly allowedOriginIdsByType: ReadonlyMap<ActionOriginType, readonly string[]>;
    };

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

/** The full wire-shape record `ActionResponseMapper` consumes. */
export interface ActionRecord {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefRecord;
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly responsible: UserRefRecord;
  readonly dueOn: Date;
  readonly status: ActionStatus;
  readonly completedAt: Date | undefined;
  readonly completedByUserId: string | undefined;
  readonly reopenedAt: Date | undefined;
  readonly reopenedByUserId: string | undefined;
  readonly reopenReason: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateActionRecordInput {
  readonly code: string;
  readonly orgUnitId: string;
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly responsibleUserId: string;
  readonly dueOn: Date;
}

/** `undefined` means "leave unchanged" — the same convention
 * `UpdateEvidenceChanges` establishes. `status` is deliberately absent:
 * `updateAction` never changes lifecycle status (contract's own
 * description) — see `ActionTransitionChanges` below for that path. */
export interface UpdateActionChanges {
  readonly title?: string;
  readonly description?: string | null;
  readonly responsibleUserId?: string;
  readonly dueOn?: Date;
}

/** The full set of columns a lifecycle transition may stamp
 * (`TransitionActionUseCase`, T052) — computed by the use case from
 * `action.entity.ts`'s transition table, never decided by the repository. */
export interface ActionTransitionChanges {
  readonly status: ActionStatus;
  readonly completedAt: Date | null;
  readonly completedByUserId: string | null;
  readonly reopenedAt: Date | null;
  readonly reopenedByUserId: string | null;
  readonly reopenReason: string | null;
}

export interface ActionListFilter {
  readonly status?: ActionStatus | undefined;
  /** 007-implementation-remediation, Frente A — a multi-value alternative
   * to `status` (additive; either may be set, never both — the risk
   * module's treatment-action listing needs a CSV multi-select filter,
   * `contracts/risks.openapi.yaml`'s `listRiskTreatmentActions`, which a
   * single `status` cannot express). AND-combined with `overdue` exactly
   * like `status` already is. */
  readonly statuses?: readonly ActionStatus[] | undefined;
  readonly responsibleUserId?: string | undefined;
  readonly originType?: ActionOriginType | undefined;
  readonly originId?: string | undefined;
  readonly orgUnitId?: string | undefined;
  /** SC-010's "ações atrasadas" view — filtered on the SAME predicate
   * `isActionOverdue` (`grc/shared/domain/overdue.service.ts`) computes on
   * read, expressed here as a persistence-layer `WHERE` fragment
   * (`status IN (OPEN, IN_PROGRESS) AND dueOn < :dueBefore`). Documented
   * parity, not a second rule (R-006): a change to which statuses are
   * overdue-eligible must update both places. */
  readonly overdue?: boolean | undefined;
  readonly dueBefore?: Date | undefined;
}

export interface ActionPageResult {
  readonly items: readonly ActionRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export abstract class ActionRepositoryPort {
  abstract create(input: CreateActionRecordInput): Promise<ActionRecord>;

  /** Scoped single-row read (ADR-004) — the SAME predicate every other
   * method here applies, so an action outside `scope` is indistinguishable
   * from one that does not exist (FR-030/FR-032). */
  abstract findById(scope: ScopeFilter, id: string): Promise<ActionRecord | undefined>;

  /** Unscoped single-row read for INTERNAL, already-authorized callers only
   * (data-model.md §7/R-003's convergence write) — mirrors
   * `RiskTreatmentActionRepositoryPort.findById`'s own "the caller already
   * authorized the parent" reasoning. Never called from `grc/action`'s own
   * controller-facing use cases, which always use the scoped `findById`
   * above. */
  abstract findByIdUnscoped(id: string): Promise<ActionRecord | undefined>;

  /** Scoped conditional update. Returns `undefined` when `id` is outside
   * `scope` or does not exist. */
  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateActionChanges,
  ): Promise<ActionRecord | undefined>;

  /** Scoped lifecycle transition (FR-015/FR-016) — applies EVERY column
   * `ActionTransitionChanges` names in one write. Returns `undefined` under
   * the same out-of-scope/not-found rule as `update`. */
  abstract transition(
    scope: ScopeFilter,
    id: string,
    changes: ActionTransitionChanges,
  ): Promise<ActionRecord | undefined>;

  /**
   * Unscoped lifecycle write for the `RISK_TREATMENT` convergence mirror
   * ONLY (T055/R-003) — see
   * `modules/risk/application/treatment-actions/mirror-action-status
   * .usecase.ts` (referenced from the risk module) for why this is a
   * SEPARATE method from `transition` above rather than that method reused:
   * the risk module's own `UpdateRiskTreatmentActionRequest` has no
   * transition-legality gate and no reopen-reason field, so the mirror
   * write must not run `action.entity.ts`'s `assertLegalActionTransition`/
   * `assertReopenReasonProvided` — those gate `Action`'s OWN
   * `transitionAction` endpoint, not every write to this table. No scope
   * predicate: the caller (risk module) already authorized the parent
   * `Risk` via `risk:treat` before this is ever called.
   */
  abstract mirrorTransition(
    id: string,
    changes: ActionTransitionChanges,
  ): Promise<ActionRecord | undefined>;

  /**
   * Assurance fix (Fix 2, confirmed drift) — the field-edit counterpart to
   * `mirrorTransition` above, for the SAME `RISK_TREATMENT` convergence
   * mirror. `UpdateTreatmentActionUseCase` can change `title`,
   * `description`, `responsibleUserId` and `dueOn` on `RiskTreatmentAction`
   * — before this fix, none of those reached the shared `Action`, so
   * "Minhas ações" kept showing the values from creation time indefinitely.
   * Applies exactly the columns `UpdateActionChanges` names (the SAME
   * shape `Action`'s own `updateAction` endpoint writes), unscoped: the
   * risk module has already authorized the parent `Risk` via `risk:treat`
   * before this is ever called, identical to `mirrorTransition`'s own
   * reasoning.
   */
  abstract mirrorFieldUpdate(
    id: string,
    changes: UpdateActionChanges,
  ): Promise<ActionRecord | undefined>;

  /**
   * Scoped, paginated listing (FR-014). `restriction` replaces the plain
   * `ScopeFilter` every other method here takes — see
   * `ActionOriginScopeRestriction`'s own doc comment for why (Fix 1:
   * `Action.orgUnitId` is a stale snapshot; the restriction is built from
   * the origin's LIVE unit instead).
   */
  abstract list(
    restriction: ActionOriginScopeRestriction,
    filter: ActionListFilter,
    page: number,
    pageSize: number,
  ): Promise<ActionPageResult>;

  /**
   * 009-indicators-reports, T026 — `ACTION_OVERDUE_COUNT`. Unlike `list`
   * above, scoped directly by `Action.orgUnitId` itself (a plain
   * `ScopeFilter`, not `ActionOriginScopeRestriction`) — this indicator
   * counts by the action's OWN organizational unit, the same column every
   * other indicator provider filters its source table on
   * (data-model.md §8 of `009-indicators-reports`, second row: "filtrando
   * pela coluna `org_unit_id` da própria tabela — nunca por junção"),
   * never the live origin-resolution `list` needs for its own stronger
   * per-row guarantee. `referenceDate` is required, mirroring
   * `isActionOverdue`'s own discipline
   * (`grc/shared/domain/overdue.service.ts`) of never reading the clock
   * inside a derived-state computation.
   */
  abstract countOverdueInScope(scope: ScopeFilter, referenceDate: Date): Promise<number>;

  /**
   * `GET /dashboard/summary`'s `breakdowns.actions.byStatus` — a
   * zero-filled count of every `ActionStatus`, scoped by `Action.orgUnitId`
   * itself, the SAME column/predicate `countOverdueInScope` above already
   * applies via `this.applyScope` — never a join, never
   * `ActionOriginScopeRestriction` (that shape exists only for `list`'s
   * own live-origin-resolution guarantee, this port's own header).
   */
  abstract getStatusBreakdown(scope: ScopeFilter): Promise<Readonly<Record<ActionStatus, number>>>;

  /**
   * `GET /dashboard/summary`'s `breakdowns.actions.dueSoon` — a count of
   * actions whose `status` is one of `OVERDUE_ELIGIBLE_ACTION_STATUSES`
   * (`grc/shared/domain/overdue.service.ts`, the SAME set
   * `countOverdueInScope` and `isActionOverdue` both read) and whose
   * `dueOn` falls in `[fromInclusive, toExclusive)` — i.e. NOT yet overdue.
   * `fromInclusive`/`toExclusive` are supplied by the caller (normally
   * `todayDateOnlyUtc()` and seven days after it), never computed here, the
   * same "one 'now' per request, decided by the caller" discipline
   * `countOverdueInScope`'s own `referenceDate` parameter already follows.
   */
  abstract countDueSoonInScope(
    scope: ScopeFilter,
    fromInclusive: Date,
    toExclusive: Date,
  ): Promise<number>;
}
