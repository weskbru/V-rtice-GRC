/**
 * T153/T157 — port for the `Approval` table (data-model.md §11, FR-029,
 * FR-029a to FR-029d). `RequestApprovalUseCase` and `DecideApprovalUseCase`
 * depend on this abstract class, never on `PrismaService` directly
 * (ADR-011).
 *
 * `decide` is the ONLY mutation this port exposes, matching the migration's
 * database-enforced guarantee (`approvals_append_only` trigger,
 * `20260905170100_risk_lifecycle_and_approvals_baseline`) that a `PENDING`
 * row may be updated exactly once, to record a decision, and never again.
 *
 * `modules/risk/infrastructure/approval.repository.ts` is the only
 * implementation, wired in `risk.module.ts`.
 */
import type { UserRefRecord } from './risk-repository.port';
import type { ApprovableEntityType, ApprovalStatus } from '@prisma/client';

export interface ApprovalRecord {
  readonly id: string;
  readonly entityType: ApprovableEntityType;
  readonly entityId: string;
  readonly requestedTransition: string;
  readonly requestedBy: UserRefRecord;
  readonly requestedAt: Date;
  readonly status: ApprovalStatus;
  readonly decidedBy: UserRefRecord | null;
  readonly decidedAt: Date | null;
  readonly justification: string | null;
}

export interface CreateApprovalInput {
  readonly entityType: ApprovableEntityType;
  readonly entityId: string;
  readonly requestedTransition: string;
  readonly requestedByUserId: string;
  readonly justification: string | null;
}

export interface DecideApprovalInput {
  readonly id: string;
  readonly decidedByUserId: string;
  /** Never `PENDING` — a decision always moves the row to one of these two
   * terminal statuses (the schema's own `ApprovalStatus` enum still
   * includes `PENDING` because it is also the row's initial value; this
   * narrower type is what makes an attempt to "decide" back into `PENDING`
   * a compile error at the one call site that matters). */
  readonly status: Exclude<ApprovalStatus, 'PENDING'>;
  readonly justification: string | null;
}

export abstract class ApprovalRepositoryPort {
  /** Pure insert — no scope predicate: the caller
   * (`RequestApprovalUseCase`) has already resolved and scope-checked the
   * parent `Risk` before this is ever called. */
  abstract create(input: CreateApprovalInput): Promise<ApprovalRecord>;

  /** Single-row lookup by id, regardless of status — used by
   * `DecideApprovalUseCase` and `GetRiskLifecycleUseCase` (for
   * `pendingApproval`). */
  abstract findById(id: string): Promise<ApprovalRecord | undefined>;

  /** The one `PENDING` approval for `(entityType, entityId)`, or `undefined`
   * — mirrors the `approvals_one_pending_per_entity` partial unique index
   * (data-model.md §11: "one PENDING approval per entity"). */
  abstract findPendingByEntity(
    entityType: ApprovableEntityType,
    entityId: string,
  ): Promise<ApprovalRecord | undefined>;

  /** Every approval request/decision for `(entityType, entityId)`, newest
   * first (`requestedAt DESC`) — `GET /risks/{riskId}/approvals` (FR-029b,
   * SC-016: "every request and decision is retrievable"). */
  abstract listByEntity(
    entityType: ApprovableEntityType,
    entityId: string,
  ): Promise<readonly ApprovalRecord[]>;

  /**
   * FR-029b — records a decision on a `PENDING` approval. The ONLY mutation
   * this port (or the underlying table — see the migration's
   * `approvals_append_only` trigger) ever performs; every request-side
   * column is left untouched. Callers MUST have already verified
   * `status === 'PENDING'` (`DecideApprovalUseCase` does, via `findById`,
   * before calling this) — the trigger is the database backstop for that
   * check, not the primary path, so a violation here should never be the
   * first time the caller learns about it.
   */
  abstract decide(input: DecideApprovalInput): Promise<ApprovalRecord>;
}
