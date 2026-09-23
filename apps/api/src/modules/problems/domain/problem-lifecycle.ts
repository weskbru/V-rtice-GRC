import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { ProblemStatus } from '@prisma/client';

export type ProblemTransitionPreconditionId =
  'HAS_ROOT_CAUSE' | 'HAS_CANCELLATION_REASON' | 'HAS_REOPEN_REASON';

export interface ProblemLifecycleTransitionRule {
  readonly from: ProblemStatus;
  readonly to: ProblemStatus;
  readonly requiredPermission: PermissionIdentifier;
  readonly preconditions: readonly ProblemTransitionPreconditionId[];
}

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
  { from: 'RESOLVED', to: 'CLOSED', requiredPermission: 'problem:transition', preconditions: [] },
  {
    from: 'RESOLVED',
    to: 'IN_ANALYSIS',
    requiredPermission: 'problem:transition',
    preconditions: ['HAS_REOPEN_REASON'],
  },
];

export const OPEN_PROBLEM_STATUSES: readonly ProblemStatus[] = Array.from(
  new Set(PROBLEM_LIFECYCLE_TRANSITIONS.map((rule) => rule.from)),
);

export function findProblemLifecycleTransition(
  from: ProblemStatus,
  to: ProblemStatus,
): ProblemLifecycleTransitionRule | undefined {
  return PROBLEM_LIFECYCLE_TRANSITIONS.find((rule) => rule.from === from && rule.to === to);
}

export interface ProblemTransitionContext {
  readonly rootCause: string | null | undefined;
  readonly cancellationReason: string | null | undefined;
  readonly reopenReason: string | null | undefined;
}

export interface ProblemPreconditionResult {
  readonly id: ProblemTransitionPreconditionId;
  readonly met: boolean;
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

export function evaluateProblemPrecondition(
  id: ProblemTransitionPreconditionId,
  ctx: ProblemTransitionContext,
): ProblemPreconditionResult {
  return EVALUATORS[id](ctx);
}

export function evaluateProblemPreconditions(
  ids: readonly ProblemTransitionPreconditionId[],
  ctx: ProblemTransitionContext,
): readonly ProblemPreconditionResult[] {
  return ids.map((id) => evaluateProblemPrecondition(id, ctx));
}
