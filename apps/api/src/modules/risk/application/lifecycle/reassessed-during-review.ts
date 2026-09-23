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
    return false;
  }

  return risk.lastAssessedOn.getTime() >= startOfUtcDay(enteredReview.performedAt).getTime();
}
