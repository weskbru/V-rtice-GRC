/**
 * T122 — `RiskScoringService` (ADR-006, FR-062, FR-063). The ONLY place a
 * risk score or level is ever computed (Constitution VI forbids duplicated
 * calculation logic) — `CreateAssessmentUseCase` (T124), a future register
 * level-filter and future dashboard aggregates all call `.score()` and
 * never re-derive a level any other way.
 *
 * **Pure domain service, exactly per ADR-006**: no I/O, no NestJS/framework
 * import, no Prisma import (not even type-only — see `methodology.schema
 * .ts`'s header for why `RiskLevelValue` is this module's own literal union
 * rather than `@prisma/client`'s `RiskLevel`). No `@Injectable()` decorator
 * either: a NestJS decorator is itself a framework import, and this class
 * needs no dependency injection — it is stateless, so every caller simply
 * constructs `new RiskScoringService()` directly.
 *
 * ## Level is ALWAYS derived from `levelBands`, never from a matrix cell's
 * ## stored `level`
 *
 * A `MatrixCellConfig` carries its own `level` field (mirroring
 * `contracts/platform.openapi.yaml`'s `MatrixCell` schema, which exists so
 * the API can return a fully-labeled matrix for display), but `score()`
 * below never reads it. The single source of truth for "which level does
 * this score belong to" is `levelBands` — the matrix's own `level` values
 * are validated for AGREEMENT with the bands at publish time
 * (`methodology.schema.ts`'s `validateMatrixBandConsistency`), not trusted
 * at scoring time. This is what makes FR-063's "single centralized rule
 * set" literally true rather than "two rule sets kept in sync by
 * discipline": there is exactly one code path from `score` to `level`, and
 * it runs through `levelBands` every time.
 */
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
  /**
   * Derives `{ score, level }` for one probability/impact pair against one
   * pinned methodology version (ADR-006's literal signature). Throws
   * `ValidationDomainError` (422, field `probability` or `impact`) when
   * either factor is not a value present in the corresponding configured
   * scale (FR-067) — the caller (`CreateAssessmentUseCase`) remaps that
   * generic field name to the request's actual `inherentProbability`/
   * `residualImpact`/... field when translating to a client-facing error,
   * since this method is called once per factor pair (inherent, residual)
   * and has no notion of which pair it is currently scoring.
   */
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

    // A matching cell is guaranteed to exist: `validateMethodologyConfiguration`
    // (methodology.schema.ts) refuses to let a version publish unless the
    // matrix covers every (probability, impact) combination of the declared
    // scales, and both factors were just proven to be scale members above.
    // The `find` failing would mean a version was stored without going
    // through that validation — a programming error, not a client input
    // error, so it throws a plain `Error` rather than another
    // `ValidationDomainError`.
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

    // Same reasoning: `validateMethodologyConfiguration` refuses to publish
    // a version whose bands do not fully cover the matrix's score range, so
    // every valid cell score falls inside exactly one band.
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
