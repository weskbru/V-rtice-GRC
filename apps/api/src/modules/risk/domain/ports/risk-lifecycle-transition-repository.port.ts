/**
 * T153/T156 — port for the append-only `RiskLifecycleTransition` table
 * (data-model.md §11, FR-083). `PerformTransitionUseCase` and
 * `DecideApprovalUseCase` depend on this abstract class, never on
 * `PrismaService` directly (ADR-011).
 *
 * There is no `update`/`supersede` method here — this table has NO
 * legitimate mutation at all (unlike `RiskTreatmentDecisionRepositoryPort`'s
 * `supersede`), matching the migration's database-enforced guarantee
 * (`REVOKE UPDATE, DELETE` on `risk_lifecycle_transitions`,
 * `20260905170100_risk_lifecycle_and_approvals_baseline`) that the
 * restricted application role cannot mutate a row after insert.
 *
 * `modules/risk/infrastructure/risk-lifecycle-transition.repository.ts` is
 * the only implementation, wired in `risk.module.ts`.
 */
import type { UserRefRecord } from './risk-repository.port';
import type { RiskStatus } from '@prisma/client';

export interface LifecycleTransitionRecord {
  readonly id: string;
  readonly riskId: string;
  readonly fromStatus: RiskStatus;
  readonly toStatus: RiskStatus;
  readonly performedBy: UserRefRecord;
  readonly performedAt: Date;
  readonly justification: string | null;
  readonly approvalId: string | null;
}

export interface CreateLifecycleTransitionInput {
  readonly riskId: string;
  readonly fromStatus: RiskStatus;
  readonly toStatus: RiskStatus;
  readonly performedByUserId: string;
  readonly justification: string | null;
  /** Set only for a transition APPLIED by an approval decision
   * (`DecideApprovalUseCase`) — `null`/omitted for every direct, non-gated
   * transition (`PerformTransitionUseCase`). */
  readonly approvalId?: string | null;
}

export abstract class RiskLifecycleTransitionRepositoryPort {
  /** Pure insert — no scope predicate: the caller has already resolved and
   * scope-checked the parent `Risk` via `RiskRepositoryPort.findById`
   * before this is ever called (same reasoning as
   * `RiskAssessmentRepositoryPort.create`'s own doc comment). */
  abstract create(input: CreateLifecycleTransitionInput): Promise<LifecycleTransitionRecord>;

  /**
   * The most recent transition INTO `toStatus` for `riskId`, or `undefined`
   * if the risk has never entered that status. Used by the application
   * layer to resolve the `REASSESSED_DURING_REVIEW` precondition
   * (`domain/transition-preconditions.ts`'s own header) — the ONLY I/O this
   * module performs on behalf of that otherwise-pure precondition table.
   */
  abstract findMostRecentInto(
    riskId: string,
    toStatus: RiskStatus,
  ): Promise<LifecycleTransitionRecord | undefined>;

  /**
   * T166/US7 — every transition for `riskId`, newest first (`performedAt
   * DESC`, then `id DESC` as a UUIDv7 insertion-order tiebreak — same
   * convention as `RiskAssessmentRepositoryPort.listByRisk`). Unpaginated:
   * this table's row count per risk is bounded by the number of lifecycle
   * transitions a single risk can accumulate, which is small; the caller
   * (`RiskHistoryQueryService`) merges it with several other bounded,
   * per-risk sources before paginating the COMBINED result. Access to
   * `riskId` itself must already have been authorized by the caller.
   */
  abstract listByRisk(riskId: string): Promise<readonly LifecycleTransitionRecord[]>;
}
