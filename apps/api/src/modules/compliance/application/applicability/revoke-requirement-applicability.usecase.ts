/**
 * T046/004-compliance-management, User Story 3 —
 * `RevokeRequirementApplicabilityUseCase`. `DELETE
 * /requirements/{requirementId}/applicability-declarations/{declarationId}`
 * (`revokeRequirementApplicabilityDeclaration` operation, research.md
 * D-7). Stamps `revokedAt`/`revokedByUserId`; the row is preserved, never
 * deleted.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { registerComplianceAuditAllowlists } from '../../domain/compliance-audit-allowlist';
import { ComplianceReferenceDataPort } from '../../domain/ports/compliance-reference-data.port';
import { RequirementApplicabilityRepositoryPort } from '../../domain/ports/requirement-applicability-repository.port';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';
import { RequirementComplianceReaderService } from '../requirement-compliance-reader.service';

export interface RevokeRequirementApplicabilityInput {
  readonly actorUserId: string;
  readonly requirementId: string;
  readonly declarationId: string;
}

@Injectable()
export class RevokeRequirementApplicabilityUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly applicabilityRepository: RequirementApplicabilityRepositoryPort,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
    private readonly complianceReader: RequirementComplianceReaderService,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: RevokeRequirementApplicabilityInput): Promise<void> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const requirement = await this.requirementRepository.findById(input.requirementId);
    if (!requirement) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.requirementEntityLabel,
        input.requirementId,
      );
    }

    const declaration = await this.applicabilityRepository.findById(
      input.requirementId,
      input.declarationId,
    );
    if (!declaration) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.applicabilityDeclarationEntityLabel,
        input.declarationId,
      );
    }
    if (declaration.revokedAt !== undefined) {
      throw new ValidationDomainError(USER_MESSAGES.compliance.applicability.alreadyRevoked, [
        { field: 'declarationId', message: USER_MESSAGES.compliance.applicability.alreadyRevoked },
      ]);
    }

    const revokedAt = new Date();
    await this.transactionRunner.run(async () => {
      await this.applicabilityRepository.revoke(input.declarationId, input.actorUserId, revokedAt);

      await this.auditRecorder.record({
        action: 'compliance.requirement_applicability_revoked',
        entityType: AuditEntityType.REQUIREMENT_APPLICABILITY,
        entityId: declaration.id,
        actorLabel: actor.fullName,
        newValues: { requirementId: input.requirementId, revokedAt },
      });
    });

    // The requirement is applicable again and re-enters the compliance
    // calculation on the next read; research.md D-11's own side-effect
    // audit.
    await this.complianceReader.deriveForOne(input.requirementId, revokedAt);
  }
}
