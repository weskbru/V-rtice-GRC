/**
 * T088 — port for persisting and reading `Risk` records. The
 * create/get/update use cases (T089/T090, plus the read path the controller
 * needs) depend on this abstract class, never on the Prisma-backed
 * `RiskRepository` directly (ADR-011: `module-application` may not import
 * `module-infrastructure`).
 *
 * `modules/risk/infrastructure/risk.repository.ts` is the only
 * implementation, wired in `risk.module.ts`. It extends `ScopedRepository`
 * (`shared/persistence/scoped-repository.ts`) so every method below is
 * required to take a `ScopeFilter` — FR-025: "evaluate every access
 * decision against ... the organizational scope of the record being
 * accessed, enforced ... on every read and every write of a risk".
 *
 * Every type here is a plain domain-level shape, never a re-export of a
 * Prisma model (ADR-009: "Prisma models never cross the presentation
 * boundary" — the same discipline extends inward: the repository's return
 * type is already the DTO-mapper's input, not `@prisma/client`'s `Risk`).
 */
import type { AssessmentRecord } from './risk-assessment-repository.port';
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { RiskLevel, RiskStatus } from '@prisma/client';

export interface ReferenceDataRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface RiskStatementRecord {
  readonly id: string;
  readonly description: string;
  readonly sortOrder: number;
}

/** One risk, exactly as the presentation layer's mapper needs it — every
 * relation already resolved to its `*RefRecord` shape rather than a raw
 * foreign key, so the mapper never has to reach back into Prisma. */
export interface RiskRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly status: RiskStatus;
  readonly category: ReferenceDataRefRecord | undefined;
  readonly type: ReferenceDataRefRecord | undefined;
  readonly origin: ReferenceDataRefRecord | undefined;
  readonly orgUnit: OrgUnitRefRecord;
  readonly owner: UserRefRecord;
  readonly responsible: UserRefRecord | undefined;
  readonly inherentScore: number | undefined;
  readonly inherentLevel: RiskLevel | undefined;
  readonly residualScore: number | undefined;
  readonly residualLevel: RiskLevel | undefined;
  /** T120/US4 — the risk's current assessment pointer (FR-065). `undefined`
   * for a risk never assessed. */
  readonly currentAssessmentId: string | undefined;
  /** T126 — the current assessment's own record, loaded as part of THIS
   * query (see `RiskRepository.findById`'s include tree) — never a second
   * repository round trip, so `GET /risks/{riskId}` stays a single-query
   * read regardless of whether the risk has been assessed. `undefined`
   * exactly when `currentAssessmentId` is `undefined`. */
  readonly currentAssessment: AssessmentRecord | undefined;
  /** T126 — the level-only snapshot of `currentAssessment`'s predecessor
   * (`AssessmentRecord.previousAssessmentId`), needed ONLY to compute
   * `RiskAssessment.levelChange` per the contract (FR-066) — a narrower
   * projection than a full `AssessmentRecord` because that is all
   * `toAssessmentResponse`'s `levelChange` computation ever reads.
   * `undefined` when there was no predecessor, or `currentAssessment` itself
   * is `undefined`. */
  readonly previousAssessmentLevels:
    Pick<AssessmentRecord, 'inherentLevel' | 'residualLevel'> | undefined;
  /** T139/US5 — the risk's current (non-superseded) treatment decision
   * pointer (FR-073). `undefined` for a risk with no treatment decision
   * recorded yet. */
  readonly currentTreatmentId: string | undefined;
  readonly identifiedOn: Date;
  readonly lastAssessedOn: Date | undefined;
  readonly nextReviewOn: Date | undefined;
  readonly pendingApprovalId: string | undefined;
  readonly archivedAt: Date | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly causes: readonly RiskStatementRecord[];
  readonly consequences: readonly RiskStatementRecord[];
}

export interface CreateRiskRecordInput {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly categoryId: string | undefined;
  readonly typeId: string | undefined;
  readonly originId: string | undefined;
  readonly orgUnitId: string;
  readonly ownerUserId: string;
  readonly responsibleUserId: string | undefined;
  readonly identifiedOn: Date;
  readonly nextReviewOn: Date | undefined;
  readonly causes: readonly string[];
  readonly consequences: readonly string[];
}

/** `undefined` = leave unchanged; `null` = clear (only meaningful for the
 * nullable fields). Mirrors `UpdateRiskRequest`'s partial-update semantics
 * (`contracts/risks.openapi.yaml`: "Omitted properties are left
 * unchanged"). */
export interface UpdateRiskChanges {
  readonly title?: string;
  readonly description?: string;
  readonly categoryId?: string | null;
  readonly typeId?: string | null;
  readonly originId?: string | null;
  readonly orgUnitId?: string;
  readonly ownerUserId?: string;
  readonly responsibleUserId?: string | null;
  readonly identifiedOn?: Date;
  readonly nextReviewOn?: Date | null;
}

export type RiskUpdateResult =
  | { readonly outcome: 'UPDATED'; readonly record: RiskRecord }
  | { readonly outcome: 'NOT_FOUND' }
  | {
      readonly outcome: 'VERSION_CONFLICT';
      readonly currentVersion: number;
      readonly currentStatus: RiskStatus;
    };

/**
 * T124/US4 — the values `CreateAssessmentUseCase` denormalizes onto `Risk`
 * in the SAME conditional update as the optimistic-lock check (FR-065:
 * "repoints Risk.currentAssessmentId ... in the same transaction"). A
 * dedicated type, distinct from `UpdateRiskChanges` above: these fields are
 * NEVER settable by `UpdateRiskUseCase`/`UpdateRiskRequestDto` (FR-062 —
 * "no other write path exists"), so conflating the two shapes would let a
 * future edit accidentally wire a business-content field onto this
 * assessment-only write path, or vice versa.
 */
export interface RiskAssessmentUpdateChanges {
  readonly currentAssessmentId: string;
  readonly inherentScore: number;
  readonly inherentLevel: RiskLevel;
  readonly residualScore: number;
  readonly residualLevel: RiskLevel;
  readonly lastAssessedOn: Date;
  /** `undefined` = leave `Risk.nextReviewOn` unchanged; a `Date` = set it —
   * mirrors `CreateRiskAssessmentRequest.nextReviewOn`'s "sets the risk's
   * next review date as part of the assessment" (FR-070), which is
   * optional on every assessment. */
  readonly nextReviewOn?: Date;
}

/**
 * T139/US5 — the value `RecordTreatmentUseCase` repoints onto `Risk` in the
 * SAME conditional update as the optimistic-lock check (FR-073's own
 * "current decision" pointer), mirroring `RiskAssessmentUpdateChanges`'s
 * shape and rationale one section above.
 */
export interface RiskTreatmentUpdateChanges {
  readonly currentTreatmentId: string;
}

/**
 * T156/T157/US6 — the values a lifecycle/approval write repoints onto
 * `Risk` in the SAME conditional update as the optimistic-lock check
 * (ADR-013). A single shape covers every case this module's lifecycle code
 * needs, distinguished by which fields are actually supplied:
 *
 *   - `PerformTransitionUseCase` (a direct, non-gated transition): `status`
 *     only (plus `archivedAt` for the one transition that sets it,
 *     `CLOSED -> ARCHIVED`).
 *   - `RequestApprovalUseCase`: `pendingApprovalId` only — FR-029c's
 *     "the risk stays in its current lifecycle state" means `status` is
 *     deliberately NOT part of this write.
 *   - `DecideApprovalUseCase` on `REJECTED`: `pendingApprovalId: null`
 *     only — clears the condition, `status` unchanged (FR-029c).
 *   - `DecideApprovalUseCase` on `APPROVED`: `status` (the gated target)
 *     AND `pendingApprovalId: null` together, in the SAME statement.
 */
export interface RiskLifecycleUpdateChanges {
  /** `undefined` = leave `Risk.status` unchanged. */
  readonly status?: RiskStatus;
  /** `undefined` = leave unchanged; `null` = clear the pending-approval
   * condition; a string = set it to that `Approval.id`. */
  readonly pendingApprovalId?: string | null;
  /** Set only when `status` is being set to `ARCHIVED` (FR-102). */
  readonly archivedAt?: Date;
}

export abstract class RiskRepositoryPort {
  abstract create(input: CreateRiskRecordInput): Promise<RiskRecord>;

  /** `undefined` when the risk does not exist OR exists outside `scope` —
   * the two are indistinguishable by design (FR-030). */
  abstract findById(scope: ScopeFilter, id: string): Promise<RiskRecord | undefined>;

  /**
   * F-38 — an UNSCOPED lookup of `id`'s CURRENT `orgUnitId`, ignoring
   * `scope` entirely. `undefined` only when no risk with this id exists at
   * all. Used EXCLUSIVELY on the refusal path, after `findById` (or a
   * scoped write method) has already returned nothing, so
   * `OrgScopeEnforcerService.assertExistingRecordAccessible` can tell
   * "does not exist" (no audit) apart from "exists outside scope"
   * (audited) — see that method's own doc comment. NEVER for building a
   * caller-visible response: the returned org-unit id is audit content
   * only.
   */
  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  /**
   * Every `Risk.id` whose CURRENT `orgUnitId` falls within `scope` — a
   * single scoped query, no relations loaded. Backs
   * `RiskActionOriginAccessor.listOriginIdsInScope`
   * (`grc/shared/domain/ports/action-origin-resolver.port.ts`, Fix 1):
   * `ListActionUseCase` uses this to build an `originId IN (...)`
   * predicate for `RISK_TREATMENT`-origin actions, so a list of actions
   * tracks the risk's LIVE org unit rather than the action's own stale
   * creation-time snapshot, without one scope check per listed action.
   */
  abstract listIdsInScope(scope: ScopeFilter): Promise<readonly string[]>;

  /**
   * Applies `changes` iff the row is within `scope` AND its current
   * `version` equals `expectedVersion` — a single conditional `UPDATE
   * ... WHERE id = ? AND version = ? AND <scope predicate>`, incrementing
   * `version` by exactly 1 (ADR-013). See the implementation's header for
   * why this single statement is race-free under concurrent callers with no
   * explicit row lock needed.
   */
  abstract updateWithVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: UpdateRiskChanges,
  ): Promise<RiskUpdateResult>;

  /**
   * T124/US4 — applies `changes` iff the row is within `scope` AND its
   * current `version` equals `expectedVersion` (identical race-free
   * single-statement mechanism as `updateWithVersion` — see that method's
   * implementation header). Called by `CreateAssessmentUseCase` AFTER the
   * new `RiskAssessment` row has already been inserted in the SAME
   * transaction, to repoint `Risk.currentAssessmentId` and denormalize the
   * derived levels onto it (FR-065). If this returns anything other than
   * `UPDATED`, the caller throws — which rolls back the transaction and, by
   * extension, the assessment `INSERT` that preceded it, so a failed
   * repoint never leaves an orphaned assessment behind.
   */
  abstract applyAssessmentResult(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: RiskAssessmentUpdateChanges,
  ): Promise<RiskUpdateResult>;

  /**
   * T139/US5 — identical race-free single-statement mechanism as
   * `updateWithVersion`/`applyAssessmentResult`, repointing
   * `Risk.currentTreatmentId` after the new `RiskTreatmentDecision` row
   * (and, when applicable, the previous one's supersession stamp) have
   * already been written in the SAME transaction (FR-073).
   */
  abstract applyTreatmentDecision(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: RiskTreatmentUpdateChanges,
  ): Promise<RiskUpdateResult>;

  /**
   * T140/T142/US5 — bumps `Risk.version` alone (no other column changes),
   * with the SAME conditional `WHERE id = ? AND version = ? AND <scope>`
   * mechanism as every other method here. Used by treatment-action
   * create/update and control/process/asset link/unlink: none of those
   * writes changes a `Risk` column directly, but every one of them is a
   * mutation of the risk AGGREGATE (`contracts/risks.openapi.yaml`: "Every
   * mutation of a risk or of a risk-owned child requires the If-Match
   * header" — ADR-013 applied at the aggregate-root level), so the shared
   * `version` counter must still advance and still be checked, or `If-Match`
   * would never detect two such writes racing each other.
   */
  abstract touchVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
  ): Promise<RiskUpdateResult>;

  /**
   * T156/T157/US6 — applies `changes` iff the row is within `scope` AND its
   * current `version` equals `expectedVersion` (identical race-free
   * single-statement mechanism as every other method here — see
   * `updateWithVersion`'s implementation header, ADR-013). This is what
   * makes FR-085 ("concurrent transition requests result in at most one
   * applied transition") hold: two concurrent
   * `PerformTransitionUseCase`/`DecideApprovalUseCase` calls against the
   * SAME risk race through this ONE conditional `UPDATE`, and PostgreSQL's
   * row lock + `EvalPlanQual` re-check ensures only the first commits.
   */
  abstract applyLifecycleTransition(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: RiskLifecycleUpdateChanges,
  ): Promise<RiskUpdateResult>;

  /**
   * T093 — `PUT /risks/{riskId}/causes` (FR-057): replaces the risk's
   * COMPLETE ordered set of causes with `items`, in the supplied order
   * (`sortOrder` 0..n-1). An empty array clears the list. This does NOT
   * itself check scope or bump `Risk.version` — the caller
   * (`ReplaceRiskStatementsUseCase`) has already scoped-read the risk via
   * `findById` and pairs this call with `touchVersion` in the SAME
   * transaction, exactly like `CreateTreatmentActionUseCase` pairs
   * `RiskTreatmentActionRepositoryPort.create` with `touchVersion` (see that
   * use case's header) — a risk-owned child table with no `orgUnitId` of its
   * own has nothing further to scope against once the parent risk is
   * confirmed in scope.
   */
  abstract replaceCauses(
    riskId: string,
    items: readonly string[],
  ): Promise<readonly RiskStatementRecord[]>;

  /** T093 — `PUT /risks/{riskId}/consequences` (FR-057); identical
   * replacement semantics as `replaceCauses` above, against the disjoint
   * `RiskConsequence` table. */
  abstract replaceConsequences(
    riskId: string,
    items: readonly string[],
  ): Promise<readonly RiskStatementRecord[]>;
}
