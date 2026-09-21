/**
 * 008-incidents-problems, US2 — port for persisting and reading `Problem`
 * records (`contracts/problems.openapi.yaml` operations `listProblems`,
 * `createProblem`, `getProblem`, `updateProblem`, `transitionProblem`).
 * The create/read/update/transition use cases depend on this abstract
 * class, never on the Prisma-backed implementation directly (ADR-011).
 *
 * `Problem` carries no `version` column (data-model.md §1) — no
 * `If-Match`/`expectedVersion` shape here, mirroring
 * `FindingRepositoryPort`'s identical absence.
 *
 * `infrastructure/prisma-problem.repository.ts` is the only
 * implementation. This is a SEPARATE port from `ProblemLookupPort`
 * (`domain/ports/problem-lookup.port.ts`, the foundation pass's own
 * narrow scoped read for the action-origin/evidence-subject accessors) —
 * kept apart deliberately, mirroring `ControlLookupPort`/
 * `ControlRepositoryPort`'s own coexistence (F-44 #2's cost-based
 * rejection of merging them applies here too: this port's `list`/
 * `update`/`applyTransition` shapes have nothing in common with the two
 * narrow reads `ProblemActionOriginAccessor`/`ProblemEvidenceSubjectAccessor`
 * actually need).
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ProblemSeverity, ProblemStatus } from '@prisma/client';

export interface ProblemOrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ProblemUserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

/** One `Problem`, exactly as the presentation layer's mapper needs it —
 * every relation already resolved, mirroring `FindingRecord`'s
 * convention. */
export interface ProblemRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly severity: ProblemSeverity;
  readonly status: ProblemStatus;
  readonly orgUnit: ProblemOrgUnitRefRecord;
  readonly owner: ProblemUserRefRecord;
  readonly identifiedOn: Date;
  /** `null` until `status` becomes `RESOLVED` at least once (Invariant
   * P1). */
  readonly rootCause: string | undefined;
  readonly resolvedAt: Date | undefined;
  readonly resolvedBy: ProblemUserRefRecord | undefined;
  readonly closedAt: Date | undefined;
  readonly closedBy: ProblemUserRefRecord | undefined;
  readonly cancellationReason: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateProblemRecordInput {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly severity: ProblemSeverity;
  readonly orgUnitId: string;
  readonly ownerUserId: string;
  readonly identifiedOn: Date;
}

/** `undefined` = leave unchanged — mirrors `UpdateFindingChanges`'s
 * convention. No `status`: `updateProblem` never changes lifecycle status
 * (`UpdateProblemRequest` names no such property; `transitionProblem` is
 * the sole writer). No `orgUnitId` either — unlike `UpdateControlRequest`,
 * `problems.openapi.yaml`'s own `UpdateProblemRequest` does not declare
 * one, so moving a problem between organizational units is out of this
 * operation's scope entirely, not merely unvalidated. */
export interface UpdateProblemChanges {
  readonly title?: string;
  readonly description?: string;
  readonly severity?: ProblemSeverity;
  readonly ownerUserId?: string;
}

/**
 * The write a lifecycle transition applies — one method for all six legal
 * moves (`data-model.md §4`), since each is a disjoint subset of the same
 * columns rather than warranting its own dedicated method the way
 * `FindingRepositoryPort.close`/`.reopen`/`.archive` do (`Problem` has no
 * per-transition extra columns beyond the ones already modeled here, and
 * `problems.openapi.yaml` itself exposes exactly one write operation,
 * `POST .../transitions`, for every move). `null` explicitly CLEARS a
 * column (used by reopen, which blanks `resolvedAt`/`resolvedByUserId` —
 * `rootCause` is deliberately NOT cleared; see
 * `TransitionProblemUseCase`'s own header for why P1's fact survives a
 * reopen); `undefined` leaves a column untouched.
 */
export interface ApplyProblemTransitionChanges {
  readonly status: ProblemStatus;
  readonly rootCause?: string | null;
  readonly resolvedAt?: Date | null;
  readonly resolvedByUserId?: string | null;
  readonly closedAt?: Date | null;
  readonly closedByUserId?: string | null;
  readonly cancellationReason?: string | null;
  readonly cancelledAt?: Date | null;
  readonly cancelledByUserId?: string | null;
}

export interface ProblemListFilter {
  readonly status?: readonly ProblemStatus[] | undefined;
  readonly severity?: readonly ProblemSeverity[] | undefined;
  readonly search?: string | undefined;
  readonly orgUnitId?: string | undefined;
}

export type ProblemListSortField =
  'code' | 'title' | 'severity' | 'status' | 'identifiedOn' | 'updatedAt';

export interface ProblemListPage {
  readonly items: readonly ProblemRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export abstract class ProblemRepositoryPort {
  abstract create(input: CreateProblemRecordInput): Promise<ProblemRecord>;

  /** `undefined` when the problem does not exist OR exists outside
   * `scope` — the two are indistinguishable by design (FR-014 applied to
   * Problem). */
  abstract findById(scope: ScopeFilter, id: string): Promise<ProblemRecord | undefined>;

  /** F-38 — an UNSCOPED lookup of `id`'s CURRENT `orgUnitId`, ignoring
   * `scope` entirely. Used EXCLUSIVELY on the refusal path, after a
   * scoped lookup already returned nothing. */
  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateProblemChanges,
  ): Promise<ProblemRecord | undefined>;

  /** Applies a lifecycle transition's column changes, scoped. Returns
   * `undefined` under the same out-of-scope/not-found rule as `update` —
   * legality/permission/precondition checks all happen BEFORE this is
   * ever called (`TransitionProblemUseCase`). */
  abstract applyTransition(
    scope: ScopeFilter,
    id: string,
    changes: ApplyProblemTransitionChanges,
  ): Promise<ProblemRecord | undefined>;

  /**
   * The `completedByUserId` of every `Action` with
   * `originType = 'PROBLEM'`, `originId = problemId` and
   * `status = 'COMPLETED'` — Invariant P2 (`length > 0` means a qualifying
   * action exists) and Invariant P3 (does it include the closer). Direct
   * query against the shared `actions` table, mirroring
   * `FindingRepositoryPort.findCompletedLinkedActionResponsibles`'s
   * identical shape and reasoning (no cross-capability port — see that
   * port's own doc comment).
   */
  abstract findCompletedOriginActionCompleters(problemId: string): Promise<readonly string[]>;

  abstract list(
    scope: ScopeFilter,
    filter: ProblemListFilter,
    page: number,
    pageSize: number,
    sort: ProblemListSortField,
    direction: 'asc' | 'desc',
  ): Promise<ProblemListPage>;
}
