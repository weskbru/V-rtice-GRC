import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import { findDraftCompletenessGaps } from './risk.entity';

import type { RiskRecord } from './ports/risk-repository.port';
import type { TransitionPreconditionId } from './risk-lifecycle';

export interface PreconditionContext {
  readonly risk: RiskRecord;
  readonly reassessedDuringReview: boolean;
}

export interface PreconditionResult {
  readonly id: TransitionPreconditionId;
  readonly met: boolean;
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

export function evaluatePrecondition(
  id: TransitionPreconditionId,
  ctx: PreconditionContext,
): PreconditionResult {
  return EVALUATORS[id](ctx);
}

export function evaluatePreconditions(
  ids: readonly TransitionPreconditionId[],
  ctx: PreconditionContext,
): readonly PreconditionResult[] {
  return ids.map((id) => evaluatePrecondition(id, ctx));
}
