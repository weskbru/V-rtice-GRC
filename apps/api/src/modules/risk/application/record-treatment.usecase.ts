/**
 * T139 — `RecordTreatmentUseCase` (FR-071 to FR-073, FR-025c, FR-084,
 * ADR-005, ADR-013). `POST /risks/{riskId}/treatments`
 * (`contracts/risks.openapi.yaml`'s `createRiskTreatmentDecision`).
 *
 * ## Supersession, not overwrite (FR-073)
 *
 * "Recording a new decision supersedes the previous one by stamping it, not
 * by replacing it." Concretely, inside ONE transaction:
 *
 * 1. Read the risk's PRE-transaction current treatment decision id (if any)
 *    — same "safe despite the gap before the transaction opens" reasoning
 *    `CreateAssessmentUseCase`'s own header documents: the value is only
 *    ever committed if the version-gated write below succeeds, which itself
 *    proves no concurrent write landed between the read and the commit.
 * 2. Insert the new decision row.
 * 3. If there was a previous current decision, `supersede` it — the ONE
 *    mutation `RiskTreatmentDecisionRepositoryPort` exposes, matching the
 *    ONE mutation the database's own `risk_treatment_decisions_append_only`
 *    trigger accepts (see the migration's header for the full reasoning).
 * 4. Repoint `Risk.currentTreatmentId` to the new decision, via the SAME
 *    conditional `UPDATE ... WHERE id = ? AND version = ?` mechanism every
 *    other risk-aggregate mutation in this module uses (ADR-013). If this
 *    does not affect the row, the WHOLE transaction rolls back — the new
 *    decision insert and the supersession stamp both undone — so a lost
 *    optimistic-lock race never leaves a half-applied treatment decision.
 * 5. Audit, in the same transaction (ADR-005).
 *
 * ## FR-084
 *
 * `contracts/risks.openapi.yaml`'s shared `UnprocessableEntity` response
 * names FR-084 as one of the domain rules a 422 can report, and
 * `createRiskTreatmentDecision`'s own description states it explicitly:
 * "Refused with 422 on CLOSED or ARCHIVED risks." Reuses `risk.entity.ts`'s
 * `assertBusinessContentEditable` — the same locked-status set governing
 * every other business-content write on a risk.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
} from '../../../shared/errors/domain-error';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';
import { RiskTreatmentDecisionRepositoryPort } from '../domain/ports/risk-treatment-decision-repository.port';
import { assertBusinessContentEditable } from '../domain/risk.entity';

import { parseIsoDate } from './create-risk.usecase';

import type { RiskRecord } from '../domain/ports/risk-repository.port';
import type { TreatmentDecisionRecord } from '../domain/ports/risk-treatment-decision-repository.port';
import type { TreatmentStrategy } from '@prisma/client';

const RISK_ENTITY_LABEL = 'Risco';

export interface RecordTreatmentInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly expectedVersion: number;
  readonly strategy: TreatmentStrategy;
  readonly description: string;
  readonly deadline?: string | null | undefined;
}

export interface RecordTreatmentResult {
  readonly decision: TreatmentDecisionRecord;
  readonly risk: RiskRecord;
}

@Injectable()
export class RecordTreatmentUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: RecordTreatmentInput): Promise<RecordTreatmentResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.riskRepository.findById(scope, input.riskId);
    if (!current) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    assertBusinessContentEditable(current.status);

    const deadline =
      input.deadline === undefined || input.deadline === null ? null : parseIsoDate(input.deadline);
    const previousTreatmentDecisionId = current.currentTreatmentId ?? null;

    return this.transactionRunner.run(async () => {
      const decision = await this.treatmentDecisionRepository.create({
        riskId: input.riskId,
        strategy: input.strategy,
        description: input.description,
        deadline,
        decidedByUserId: input.actorUserId,
      });

      if (previousTreatmentDecisionId) {
        await this.treatmentDecisionRepository.supersede(
          previousTreatmentDecisionId,
          decision.id,
          decision.decidedAt,
        );
      }

      const result = await this.riskRepository.applyTreatmentDecision(
        scope,
        input.riskId,
        input.expectedVersion,
        { currentTreatmentId: decision.id },
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
        action: 'risk.treatment_decided',
        entityType: AuditEntityType.RISK_TREATMENT_DECISION,
        entityId: decision.id,
        actorLabel: actor.fullName,
        newValues: {
          riskId: input.riskId,
          strategy: input.strategy,
          description: input.description,
          deadline,
          previousTreatmentDecisionId,
        },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return { decision, risk: result.record };
    });
  }
}
