/**
 * 008-incidents-problems, US2 — the declarative `Problem` lifecycle
 * transition table (data-model.md §4, research.md D-5,
 * `contracts/problems.openapi.yaml`'s `transitionProblem` description).
 * Pure domain: no I/O, no framework import (`eslint-plugin-boundaries`
 * enforces this at `module-domain`) — modeled on
 * `modules/controls/domain/control-lifecycle.ts`'s declarative
 * `(from, to, permission, preconditions)` shape.
 *
 * Every row requires the SAME permission (`problem:transition`) — unlike
 * Controls' table, which names a stricter permission for entry into
 * `RETIRED`, nothing in `problems.openapi.yaml` or spec.md distinguishes
 * one Problem transition's permission from another's.
 *
 * **`CLOSED`'s two extra invariants (P2, P3) are deliberately NOT
 * preconditions here.** Every precondition this table evaluates is
 * synchronous, derived only from the request body plus the record's
 * current state (mirrors `ControlTransitionContext`'s own shape) — P2
 * ("a completed corrective `Action` exists") and P3 ("the closer did not
 * complete it") both require a database query, which this table's
 * synchronous evaluator cannot perform. `TransitionProblemUseCase` checks
 * P2/P3 directly, via `problem.entity.ts#assertProblemHasCompletedCorrectiveAction`/
 * `#assertCloserNotSameAsCompleter`, AFTER this table's own
 * legality/permission/precondition gate passes — the same layering
 * `CloseFindingUseCase` uses for Finding's F1/F2 (checked in the use case,
 * not the lifecycle table, for the identical reason).
 */
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { ProblemStatus } from '@prisma/client';

/** Identifiers for the three SYNCHRONOUS precondition evaluators below —
 * a closed union so a transition row can only ever reference a
 * precondition this module actually implements. */
export type ProblemTransitionPreconditionId =
  'HAS_ROOT_CAUSE' | 'HAS_CANCELLATION_REASON' | 'HAS_REOPEN_REASON';

export interface ProblemLifecycleTransitionRule {
  readonly from: ProblemStatus;
  readonly to: ProblemStatus;
  readonly requiredPermission: PermissionIdentifier;
  /** Empty = no SYNCHRONOUS precondition beyond the state/permission check
   * itself — `CLOSED`'s row is exactly this case; its own (asynchronous)
   * gate is applied separately, see this file's header. */
  readonly preconditions: readonly ProblemTransitionPreconditionId[];
}

/**
 * data-model.md §4's transition table, one row per legal `(from, to)`
 * pair — the six moves `problems.openapi.yaml`'s own `transitionProblem`
 * description enumerates verbatim.
 */
export const PROBLEM_LIFECYCLE_TRANSITIONS: readonly ProblemLifecycleTransitionRule[] = [
  { from: 'OPEN', to: 'IN_ANALYSIS', requiredPermission: 'problem:transition', preconditions: [] },
  {
    from: 'OPEN',
    to: 'CANCELLED',
    requiredPermission: 'problem:transition',
    preconditions: ['HAS_CANCELLATION_REASON'],
  },
  {
    from: 'IN_ANALYSIS',
    to: 'RESOLVED',
    requiredPermission: 'problem:transition',
    preconditions: ['HAS_ROOT_CAUSE'],
  },
  {
    from: 'IN_ANALYSIS',
    to: 'CANCELLED',
    requiredPermission: 'problem:transition',
    preconditions: ['HAS_CANCELLATION_REASON'],
  },
  // CLOSED — no synchronous precondition here; P2/P3 are checked by
  // `TransitionProblemUseCase` itself (this file's own header).
  { from: 'RESOLVED', to: 'CLOSED', requiredPermission: 'problem:transition', preconditions: [] },
  // Reopen — requires `reopenReason` (data-model.md §1's own column note).
  {
    from: 'RESOLVED',
    to: 'IN_ANALYSIS',
    requiredPermission: 'problem:transition',
    preconditions: ['HAS_REOPEN_REASON'],
  },
];

/**
 * 009-indicators-reports, T028 — every `ProblemStatus` with at least one
 * outgoing row above (`OPEN`, `IN_ANALYSIS`, `RESOLVED`) — "aberto" for
 * `PROBLEM_OPEN_COUNT_BY_SEVERITY` (research.md D-4), mirroring
 * `Incident`'s own `OPEN_INCIDENT_STATUSES` reasoning: `RESOLVED` counts
 * as open because `CLOSED`, not `RESOLVED`, is this lifecycle's terminal
 * state (`RESOLVED` can still move back to `IN_ANALYSIS`). Derived from
 * `PROBLEM_LIFECYCLE_TRANSITIONS` itself, never a hand-picked second list.
 */
export const OPEN_PROBLEM_STATUSES: readonly ProblemStatus[] = Array.from(
  new Set(PROBLEM_LIFECYCLE_TRANSITIONS.map((rule) => rule.from)),
);

/** The single lookup every use case uses to answer "is (from, to)
 * legal" — `undefined` for any pair not in the table, which callers must
 * treat as a refusal, never as "no restriction". */
export function findProblemLifecycleTransition(
  from: ProblemStatus,
  to: ProblemStatus,
): ProblemLifecycleTransitionRule | undefined {
  return PROBLEM_LIFECYCLE_TRANSITIONS.find((rule) => rule.from === from && rule.to === to);
}

// ---------------------------------------------------------------------------
// Precondition evaluation — mirrors
// `control-lifecycle.ts#evaluateControlPrecondition`'s `met`/`message` shape
// ---------------------------------------------------------------------------

export interface ProblemTransitionContext {
  readonly rootCause: string | null | undefined;
  readonly cancellationReason: string | null | undefined;
  readonly reopenReason: string | null | undefined;
}

export interface ProblemPreconditionResult {
  readonly id: ProblemTransitionPreconditionId;
  readonly met: boolean;
  /** pt-BR, phrased for display — populated regardless of `met`. */
  readonly message: string;
}

function evaluateHasRootCause(ctx: ProblemTransitionContext): ProblemPreconditionResult {
  const trimmed = ctx.rootCause?.trim();
  return {
    id: 'HAS_ROOT_CAUSE',
    met: trimmed !== undefined && trimmed.length > 0,
    message: USER_MESSAGES.problems.transition.rootCauseRequired,
  };
}

function evaluateHasCancellationReason(ctx: ProblemTransitionContext): ProblemPreconditionResult {
  const trimmed = ctx.cancellationReason?.trim();
  return {
    id: 'HAS_CANCELLATION_REASON',
    met: trimmed !== undefined && trimmed.length > 0,
    message: USER_MESSAGES.problems.transition.cancellationReasonRequired,
  };
}

function evaluateHasReopenReason(ctx: ProblemTransitionContext): ProblemPreconditionResult {
  const trimmed = ctx.reopenReason?.trim();
  return {
    id: 'HAS_REOPEN_REASON',
    met: trimmed !== undefined && trimmed.length > 0,
    message: USER_MESSAGES.problems.transition.reopenReasonRequired,
  };
}

const EVALUATORS: Readonly<
  Record<
    ProblemTransitionPreconditionId,
    (ctx: ProblemTransitionContext) => ProblemPreconditionResult
  >
> = {
  HAS_ROOT_CAUSE: evaluateHasRootCause,
  HAS_CANCELLATION_REASON: evaluateHasCancellationReason,
  HAS_REOPEN_REASON: evaluateHasReopenReason,
};

/** Evaluates one precondition against `ctx`. */
export function evaluateProblemPrecondition(
  id: ProblemTransitionPreconditionId,
  ctx: ProblemTransitionContext,
): ProblemPreconditionResult {
  return EVALUATORS[id](ctx);
}

/** Evaluates every precondition a transition rule declares, in order. */
export function evaluateProblemPreconditions(
  ids: readonly ProblemTransitionPreconditionId[],
  ctx: ProblemTransitionContext,
): readonly ProblemPreconditionResult[] {
  return ids.map((id) => evaluateProblemPrecondition(id, ctx));
}
