/**
 * T155/T156/T159 — resolves the ONE input `domain/transition-preconditions
 * .ts`'s pure `REASSESSED_DURING_REVIEW` evaluator cannot compute itself:
 * "a NEW assessment has been recorded since the risk's most recent entry
 * into `UNDER_REVIEW`" (ADR-006's own wording for the `UNDER_REVIEW ->
 * ASSESSED` transition: "new assessment recorded"). This is I/O
 * (`RiskLifecycleTransitionRepositoryPort`), so it lives in the application
 * layer and is shared by every use case that needs the answer
 * (`PerformTransitionUseCase`, `GetRiskLifecycleUseCase`) rather than
 * duplicated in each — the "derived values computed in exactly one place"
 * discipline `docs/architecture.md` documents for `RiskScoringService`,
 * applied to this narrower question.
 *
 * ## Interpretive decision — date-only comparison
 *
 * `RiskAssessment` carries no creation timestamp of its own (append-only,
 * `assessedOn` is a business-supplied `DATE` with no time-of-day — see
 * `schema.prisma`'s own comment on that model), while
 * `RiskLifecycleTransition.performedAt` is a full `timestamptz`. Comparing
 * a date against an instant needs a stated rule: this resolves it as
 * "`risk.lastAssessedOn` falls on or after the UTC calendar day the risk
 * most recently entered `UNDER_REVIEW`". This is deliberately permissive
 * (same-day counts) rather than requiring a later day, because
 * `assertNotInFuture` (`CreateAssessmentUseCase`) already forbids an
 * assessment dated ahead of today, and a risk manager who enters review and
 * reassesses within the same business day should not be blocked by an
 * artifact of DATE-vs-TIMESTAMP granularity — the two events being minutes
 * apart is the expected case, not an edge case to guard against.
 */
import type { RiskLifecycleTransitionRepositoryPort } from '../../domain/ports/risk-lifecycle-transition-repository.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function resolveReassessedDuringReview(
  transitionRepository: RiskLifecycleTransitionRepositoryPort,
  risk: RiskRecord,
): Promise<boolean> {
  if (!risk.lastAssessedOn) {
    return false;
  }

  const enteredReview = await transitionRepository.findMostRecentInto(risk.id, 'UNDER_REVIEW');
  if (!enteredReview) {
    // The risk has never entered UNDER_REVIEW — this precondition is only
    // ever evaluated for the UNDER_REVIEW -> ASSESSED rule, which requires
    // the risk to currently BE in UNDER_REVIEW, so this branch is
    // defensive rather than reachable in practice.
    return false;
  }

  return risk.lastAssessedOn.getTime() >= startOfUtcDay(enteredReview.performedAt).getTime();
}
