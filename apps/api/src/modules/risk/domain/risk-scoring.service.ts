import {
  ValidationDomainError,
  type ValidationFieldError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { MethodologyConfiguration, RiskLevelValue } from './methodology.schema';

export interface AssessmentFactors {
  readonly probability: number;
  readonly impact: number;
}

export interface ScoringResult {
  readonly score: number;
  readonly level: RiskLevelValue;
}

export class RiskScoringService {
  score(factors: AssessmentFactors, methodologyVersion: MethodologyConfiguration): ScoringResult {
    assertFactorWithinScale(
      factors.probability,
      methodologyVersion.probabilityScale,
      'probability',
      USER_MESSAGES.risk.assessment.probabilityOutOfScale,
    );
    assertFactorWithinScale(
      factors.impact,
      methodologyVersion.impactScale,
      'impact',
      USER_MESSAGES.risk.assessment.impactOutOfScale,
    );

    const cell = methodologyVersion.matrix.find(
      (candidate) =>
        candidate.probability === factors.probability && candidate.impact === factors.impact,
    );
    if (!cell) {
      throw new Error(
        `RiskScoringService.score: no matrix cell for probability=${String(factors.probability)}, ` +
          `impact=${String(factors.impact)}. The methodology version was stored without passing ` +
          'validateMethodologyConfiguration.',
      );
    }

    const band = methodologyVersion.levelBands.find(
      (candidate) => cell.score >= candidate.minScore && cell.score <= candidate.maxScore,
    );
    if (!band) {
      throw new Error(
        `RiskScoringService.score: no level band covers score=${String(cell.score)}. ` +
          'The methodology version was stored without passing validateMethodologyConfiguration.',
      );
    }

    return { score: cell.score, level: band.level };
  }
}

function assertFactorWithinScale(
  value: number,
  scale: MethodologyConfiguration['probabilityScale'],
  field: string,
  message: string,
): void {
  const isMember = scale.some((point) => point.value === value);
  if (!isMember) {
    const fieldError: ValidationFieldError = { field, message };
    throw new ValidationDomainError(message, [fieldError]);
  }
}
