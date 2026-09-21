/**
 * T124 — `CreateAssessmentUseCase` (FR-062 to FR-068, FR-070, FR-025c,
 * ADR-006).
 *
 * ## Order of operations
 *
 * 1. Resolve actor + scope; read the risk (scoped — FR-025/FR-030).
 * 2. FR-084: refuse on `CLOSED`/`ARCHIVED` (reuses `risk.entity.ts`'s
 *    `assertBusinessContentEditable` — the same locked-status set governs
 *    both business-content edits and new assessments).
 * 3. Resolve the methodology version to score against: the active one, or
 *    the caller-supplied id IF it still equals the active one — anything
 *    else is refused with 422 (US4 AS5, FR-068): the platform never
 *    silently rescopes an assessment onto a stale, no-longer-active
 *    version, and never accepts one explicitly either.
 * 4. Score inherent and residual factors via `RiskScoringService` — the
 *    ONLY place either score/level is computed (ADR-006). A
 *    `ValidationDomainError` from `.score()` is re-thrown with the request
 *    DTO's actual field name (`inherentProbability`, `residualImpact`, ...)
 *    substituted for the generic `probability`/`impact` the pure service
 *    itself uses (see `remapFactorFieldError` below).
 * 5. One transaction (`TransactionRunnerPort`, same pattern as
 *    `CreateRiskUseCase`/`UpdateRiskUseCase`): insert the new assessment
 *    (linking `previousAssessmentId` to the risk's PRE-transaction current
 *    assessment), then `RiskRepositoryPort.applyAssessmentResult` — a
 *    single conditional `UPDATE ... WHERE id = ? AND version = ?`
 *    repointing `Risk.currentAssessmentId`/denormalized levels/
 *    `lastAssessedOn`/`nextReviewOn` (FR-065). If that conditional update
 *    does not affect the row (version conflict or the risk vanished from
 *    scope mid-flight), this throws — which rolls back the WHOLE
 *    transaction, including the assessment `INSERT` that ran first, so a
 *    lost race never leaves an orphaned assessment record behind. Finally,
 *    `AuditRecorder.record(...)` in the same transaction (ADR-005).
 *
 * `previousAssessmentId` is read from the PRE-transaction `current` risk
 * record — safe despite the gap before the transaction opens, for the exact
 * reason `UpdateRiskUseCase`'s field diffing is safe: the value is only
 * ever COMMITTED if the version-gated write inside the transaction
 * succeeds, which itself proves no concurrent write landed between the read
 * and the commit.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
  type ValidationFieldError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { RiskAssessmentRepositoryPort } from '../domain/ports/risk-assessment-repository.port';
import { RiskMethodologyRepositoryPort } from '../domain/ports/risk-methodology-repository.port';
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';
import { RiskScoringService } from '../domain/risk-scoring.service';
import { assertBusinessContentEditable } from '../domain/risk.entity';

import { parseIsoDate } from './create-risk.usecase';

import type { AssessmentRecord } from '../domain/ports/risk-assessment-repository.port';
import type { MethodologyVersionRecord } from '../domain/ports/risk-methodology-repository.port';
import type { RiskRecord } from '../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';

export interface CreateAssessmentInput {
  readonly actorUserId: string;
  readonly riskId: string;
  /** From the `If-Match` header (ADR-013) — the risk's expected `version`. */
  readonly expectedVersion: number;
  readonly assessedOn?: string | undefined;
  readonly inherentProbability: number;
  readonly inherentImpact: number;
  readonly residualProbability: number;
  readonly residualImpact: number;
  readonly controlIdsConsidered?: readonly string[] | undefined;
  readonly rationale?: string | null | undefined;
  readonly methodologyVersionId?: string | null | undefined;
  readonly nextReviewOn?: string | null | undefined;
}

export interface CreateAssessmentResult {
  readonly assessment: AssessmentRecord;
  readonly risk: RiskRecord;
}

@Injectable()
export class CreateAssessmentUseCase {
  private readonly scoringService = new RiskScoringService();

  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly assessmentRepository: RiskAssessmentRepositoryPort,
    private readonly methodologyRepository: RiskMethodologyRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateAssessmentInput): Promise<CreateAssessmentResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.riskRepository.findById(scope, input.riskId);
    if (!current) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    // FR-084 — the same locked-status rule as business-content edits.
    assertBusinessContentEditable(current.status);

    const methodologyVersion = await this.resolveMethodologyVersion(input.methodologyVersionId);

    const assessedOn = input.assessedOn ? parseIsoDate(input.assessedOn) : startOfTodayUtc();
    assertNotInFuture(assessedOn, USER_MESSAGES.risk.assessment.assessedOnInFuture, 'assessedOn');

    const nextReviewOn =
      input.nextReviewOn === undefined || input.nextReviewOn === null
        ? undefined
        : parseIsoDate(input.nextReviewOn);

    const inherent = this.scoreOrRemap(
      { probability: input.inherentProbability, impact: input.inherentImpact },
      methodologyVersion,
      { probability: 'inherentProbability', impact: 'inherentImpact' },
    );
    const residual = this.scoreOrRemap(
      { probability: input.residualProbability, impact: input.residualImpact },
      methodologyVersion,
      { probability: 'residualProbability', impact: 'residualImpact' },
    );

    const controlsConsidered = input.controlIdsConsidered ?? [];
    const rationale = input.rationale ?? null;
    const previousAssessmentId = current.currentAssessmentId ?? null;

    return this.transactionRunner.run(async () => {
      const assessment = await this.assessmentRepository.create({
        riskId: input.riskId,
        methodologyVersionId: methodologyVersion.id,
        assessedByUserId: input.actorUserId,
        assessedOn,
        inherentProbability: input.inherentProbability,
        inherentImpact: input.inherentImpact,
        inherentScore: inherent.score,
        inherentLevel: inherent.level,
        residualProbability: input.residualProbability,
        residualImpact: input.residualImpact,
        residualScore: residual.score,
        residualLevel: residual.level,
        controlsConsidered,
        rationale,
        previousAssessmentId,
      });

      const result = await this.riskRepository.applyAssessmentResult(
        scope,
        input.riskId,
        input.expectedVersion,
        {
          currentAssessmentId: assessment.id,
          inherentScore: inherent.score,
          inherentLevel: inherent.level,
          residualScore: residual.score,
          residualLevel: residual.level,
          lastAssessedOn: assessedOn,
          ...(nextReviewOn !== undefined ? { nextReviewOn } : {}),
        },
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
      }
      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          RISK_ENTITY_LABEL,
          input.riskId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      await this.auditRecorder.record({
        action: 'risk.assessed',
        entityType: AuditEntityType.RISK_ASSESSMENT,
        entityId: assessment.id,
        actorLabel: actor.fullName,
        newValues: {
          riskId: input.riskId,
          methodologyVersionId: methodologyVersion.id,
          assessedOn,
          inherentProbability: input.inherentProbability,
          inherentImpact: input.inherentImpact,
          inherentScore: inherent.score,
          inherentLevel: inherent.level,
          residualProbability: input.residualProbability,
          residualImpact: input.residualImpact,
          residualScore: residual.score,
          residualLevel: residual.level,
          controlsConsidered,
          previousAssessmentId,
        },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return { assessment, risk: result.record };
    });
  }

  /** US4 AS5/FR-068: omitted = active version; supplied = MUST equal the
   * active version's id, or the request is refused (422) — a stale,
   * no-longer-active version is never silently accepted. */
  private async resolveMethodologyVersion(
    methodologyVersionId: string | null | undefined,
  ): Promise<MethodologyVersionRecord> {
    const activeVersion = await this.methodologyRepository.findActiveVersion();
    if (!activeVersion) {
      throw new ValidationDomainError(USER_MESSAGES.risk.methodology.noActiveMethodology, [
        {
          field: 'methodologyVersionId',
          message: USER_MESSAGES.risk.methodology.noActiveMethodology,
        },
      ]);
    }

    if (methodologyVersionId === undefined || methodologyVersionId === null) {
      return activeVersion;
    }

    if (methodologyVersionId !== activeVersion.id) {
      throw new ValidationDomainError(USER_MESSAGES.risk.assessment.methodologyVersionNotActive, [
        {
          field: 'methodologyVersionId',
          message: USER_MESSAGES.risk.assessment.methodologyVersionNotActive,
        },
      ]);
    }

    return activeVersion;
  }

  /** Calls `RiskScoringService.score()` and remaps its generic
   * `probability`/`impact` field errors onto the request DTO's actual
   * field names (see this file's header). */
  private scoreOrRemap(
    factors: { probability: number; impact: number },
    methodologyVersion: MethodologyVersionRecord,
    fieldNames: { probability: string; impact: string },
  ): { score: number; level: AssessmentRecord['inherentLevel'] } {
    try {
      return this.scoringService.score(factors, methodologyVersion);
    } catch (error) {
      if (error instanceof ValidationDomainError) {
        const remapped: ValidationFieldError[] = error.errors.map((fieldError) => ({
          field:
            fieldError.field === 'probability'
              ? fieldNames.probability
              : fieldError.field === 'impact'
                ? fieldNames.impact
                : fieldError.field,
          message: fieldError.message,
        }));
        throw new ValidationDomainError(error.message, remapped);
      }
      throw error;
    }
  }
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function assertNotInFuture(date: Date, message: string, field: string): void {
  if (date.getTime() > startOfTodayUtc().getTime()) {
    throw new ValidationDomainError(message, [{ field, message }]);
  }
}
