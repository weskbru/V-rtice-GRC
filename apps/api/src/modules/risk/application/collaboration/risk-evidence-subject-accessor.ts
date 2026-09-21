/**
 * T030/002-shared-grc-foundation, US1 — the risk module's registration
 * against `EvidenceSubjectResolverPort`'s registry
 * (`grc/shared/domain/ports/evidence-subject-resolver.port.ts`) for
 * `EvidenceSubjectType.RISK` and `.RISK_TREATMENT_DECISION`. Mirrors
 * `risk-parent-record-accessor.ts`'s shape — see that file's own header for
 * the two-check rationale (`risk:view` permission PLUS organizational
 * scope, neither substituting for the other) this file does not repeat.
 *
 * Two classes, not one, because `EvidenceSubjectAccessor` is a
 * single-method interface and `registerEvidenceSubjectResolver` takes one
 * accessor PER subject type (the registry's own closed-type-per-value
 * shape, R-001/ADR-018) — `RiskModule`'s constructor calls it twice, once
 * per class below, exactly where `registerAttachableEntityType('RISK', ...)`
 * already sits.
 *
 * ## `RISK_TREATMENT_DECISION`'s scope is its PARENT risk's scope
 *
 * `RiskTreatmentDecision` (data-model.md §10 of
 * 001-grc-platform-foundation) carries no `orgUnitId` of its own — it
 * belongs to exactly one `Risk`, and visibility of a decision IS
 * visibility of that risk. `RiskTreatmentDecisionEvidenceSubjectAccessor`
 * therefore reads the decision only to find its `riskId`, then reuses
 * `resolveViewableRisk` below — the SAME permission-plus-scope check
 * `RISK` itself uses, composed rather than duplicated.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { RiskTreatmentDecisionRepositoryPort } from '../../domain/ports/risk-treatment-decision-repository.port';
import { GetRiskUseCase } from '../get-risk.usecase';

import type {
  EvidenceSubjectAccess,
  EvidenceSubjectAccessor,
} from '../../../../grc/shared/domain/ports/evidence-subject-resolver.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';
const RISK_TREATMENT_DECISION_LABEL = 'Decisão de tratamento de risco';

/** Resolves and permission/scope-checks the parent `Risk` a
 * `RISK`/`RISK_TREATMENT_DECISION` subject ultimately reduces to. Shared
 * by both accessor classes below rather than duplicated — the identical
 * "does the actor hold `risk:view`, and is this risk within their scope"
 * question, asked from two different subject types. */
@Injectable()
export class RiskEvidenceSubjectAccessor implements EvidenceSubjectAccessor {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  /** Registered for `EvidenceSubjectType.RISK`. */
  async resolveViewableSubject(
    actorUserId: string,
    subjectId: string,
  ): Promise<EvidenceSubjectAccess> {
    const risk = await this.resolveViewableRisk(actorUserId, subjectId);
    return {
      organizationalUnitId: risk.orgUnit.id,
      label: USER_MESSAGES.risk.evidenceSubject.riskLabel(risk.code, risk.title),
    };
  }

  /** Shared by `RiskTreatmentDecisionEvidenceSubjectAccessor` below — the
   * SAME permission-plus-scope check `resolveViewableSubject` performs,
   * returning the full `RiskRecord` so a caller may build its own label
   * from it (e.g. `code` alone, without the title). */
  async resolveViewableRisk(actorUserId: string, riskId: string): Promise<RiskRecord> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'risk:view');
    if (!canView) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, riskId);
    }
    return this.getRiskUseCase.execute({ actorUserId, riskId });
  }
}

/** Registered for `EvidenceSubjectType.RISK_TREATMENT_DECISION` — see this
 * file's own header for why it composes `RiskEvidenceSubjectAccessor`
 * rather than re-deriving the risk-side check. */
@Injectable()
export class RiskTreatmentDecisionEvidenceSubjectAccessor implements EvidenceSubjectAccessor {
  constructor(
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly riskAccessor: RiskEvidenceSubjectAccessor,
  ) {}

  async resolveViewableSubject(
    actorUserId: string,
    subjectId: string,
  ): Promise<EvidenceSubjectAccess> {
    const decision = await this.treatmentDecisionRepository.findById(subjectId);
    if (!decision) {
      throw new NotFoundDomainError(RISK_TREATMENT_DECISION_LABEL, subjectId);
    }

    // Assurance fix (confirmed breach, FR-030): `resolveViewableRisk` below
    // throws `NotFoundDomainError('Risco', decision.riskId)` when the
    // PARENT risk is out of scope — a DIFFERENT entity, with a DIFFERENT
    // label, embedding a UUID (`decision.riskId`) the caller never
    // supplied (they supplied `subjectId`, the decision's own id). Left
    // unconverted, that response would both disclose a fresh
    // cross-organization identifier and make "this decision does not
    // exist" byte-distinguishable from "it exists but its risk is out of
    // scope" — re-key to the DECISION's own id/label here, mirroring
    // `core/files/application/attachment-access.ts`'s documented
    // reasoning for the identical class of bug on attachments.
    try {
      const risk = await this.riskAccessor.resolveViewableRisk(actorUserId, decision.riskId);

      return {
        organizationalUnitId: risk.orgUnit.id,
        label: USER_MESSAGES.risk.evidenceSubject.treatmentDecisionLabel(
          risk.code,
          USER_MESSAGES.risk.history.treatmentStrategyLabels[decision.strategy],
        ),
      };
    } catch (error) {
      if (error instanceof NotFoundDomainError) {
        throw new NotFoundDomainError(RISK_TREATMENT_DECISION_LABEL, subjectId);
      }
      throw error;
    }
  }
}
