/**
 * T155 — precondition evaluators for `domain/risk-lifecycle.ts`'s
 * `TransitionPreconditionId`s (ADR-006, FR-080/FR-081/FR-082). Pure domain:
 * no I/O, no framework import.
 *
 * `REASSESSED_DURING_REVIEW` is the one precondition this table cannot
 * decide from `RiskRecord` alone — "a NEW assessment recorded [since
 * entering UNDER_REVIEW]" requires comparing against lifecycle transition
 * HISTORY, which is I/O this module may not perform (T155's own "no I/O"
 * constraint). The application layer (`PerformTransitionUseCase`,
 * `GetRiskLifecycleUseCase`) resolves that comparison itself — using
 * `RiskLifecycleTransitionRepositoryPort.findMostRecentInto` to find the
 * risk's most recent entry into `UNDER_REVIEW`, then comparing its
 * `performedAt` against the current assessment's `assessedOn` — and passes
 * only the resulting BOOLEAN into `PreconditionContext.reassessedDuringReview`
 * below. This module only ever consumes that pre-computed answer; it never
 * fetches it itself.
 */
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import { findDraftCompletenessGaps } from './risk.entity';

import type { RiskRecord } from './ports/risk-repository.port';
import type { TransitionPreconditionId } from './risk-lifecycle';

export interface PreconditionContext {
  readonly risk: RiskRecord;
  /** Pre-computed by the caller (application layer) — see this file's
   * header. Ignored by every evaluator except `REASSESSED_DURING_REVIEW`. */
  readonly reassessedDuringReview: boolean;
}

export interface PreconditionResult {
  readonly id: TransitionPreconditionId;
  readonly met: boolean;
  /** pt-BR, phrased for display (FR-081, US6 AS3) — populated regardless of
   * `met`, so a caller can always render "what this precondition requires"
   * without a second lookup; only unmet ones are surfaced to the client. */
  readonly message: string;
}

function evaluateDraftFieldsComplete(ctx: PreconditionContext): PreconditionResult {
  const gaps = findDraftCompletenessGaps({
    title: ctx.risk.title,
    description: ctx.risk.description,
    categoryId: ctx.risk.category?.id,
    orgUnitId: ctx.risk.orgUnit.id,
    ownerUserId: ctx.risk.owner.id,
  });

  return {
    id: 'DRAFT_FIELDS_COMPLETE',
    met: gaps.length === 0,
    message: USER_MESSAGES.risk.lifecycle.preconditions.draftFieldsIncomplete,
  };
}

function evaluateHasAssessment(ctx: PreconditionContext): PreconditionResult {
  return {
    id: 'HAS_ASSESSMENT',
    met: ctx.risk.currentAssessmentId !== undefined,
    message: USER_MESSAGES.risk.lifecycle.preconditions.hasAssessment,
  };
}

function evaluateHasTreatmentDecision(ctx: PreconditionContext): PreconditionResult {
  return {
    id: 'HAS_TREATMENT_DECISION',
    met: ctx.risk.currentTreatmentId !== undefined,
    message: USER_MESSAGES.risk.lifecycle.preconditions.hasTreatmentDecision,
  };
}

function evaluateReassessedDuringReview(ctx: PreconditionContext): PreconditionResult {
  return {
    id: 'REASSESSED_DURING_REVIEW',
    met: ctx.reassessedDuringReview,
    message: USER_MESSAGES.risk.lifecycle.preconditions.reassessedDuringReview,
  };
}

const EVALUATORS: Readonly<
  Record<TransitionPreconditionId, (ctx: PreconditionContext) => PreconditionResult>
> = {
  DRAFT_FIELDS_COMPLETE: evaluateDraftFieldsComplete,
  HAS_ASSESSMENT: evaluateHasAssessment,
  HAS_TREATMENT_DECISION: evaluateHasTreatmentDecision,
  REASSESSED_DURING_REVIEW: evaluateReassessedDuringReview,
};

/** Evaluates one precondition against `ctx`. */
export function evaluatePrecondition(
  id: TransitionPreconditionId,
  ctx: PreconditionContext,
): PreconditionResult {
  return EVALUATORS[id](ctx);
}

/** Evaluates every precondition a transition rule declares, in order. An
 * empty `ids` array (no precondition) returns an empty result array —
 * every caller treats that as "nothing to check", not as an implicit
 * failure. */
export function evaluatePreconditions(
  ids: readonly TransitionPreconditionId[],
  ctx: PreconditionContext,
): readonly PreconditionResult[] {
  return ids.map((id) => evaluatePrecondition(id, ctx));
}
