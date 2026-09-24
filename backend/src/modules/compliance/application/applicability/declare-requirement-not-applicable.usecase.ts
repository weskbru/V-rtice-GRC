import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import {
  ConflictDomainError,
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

import type { RequirementApplicabilityDeclarationRecord } from '../../domain/requirement-applicability-declaration.entity';

export interface DeclareRequirementNotApplicableInput {
  readonly actorUserId: string;
  readonly requirementId: string;
  readonly justification: string | undefined;
}

@Injectable()
export class DeclareRequirementNotApplicableUseCase {
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

  async execute(
    input: DeclareRequirementNotApplicableInput,
  ): Promise<RequirementApplicabilityDeclarationRecord> {
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

    const justification = input.justification?.trim();
    if (!justification) {
      throw new ValidationDomainError(
        USER_MESSAGES.compliance.applicability.justificationRequired,
        [
          {
            field: 'justification',
            message: USER_MESSAGES.compliance.applicability.justificationRequired,
          },
        ],
      );
    }

    const active = await this.applicabilityRepository.findActive(input.requirementId);
    if (active) {
      throw new ConflictDomainError(USER_MESSAGES.compliance.applicability.alreadyDeclared);
    }

    const declaredAt = new Date();
    const declaration = await this.transactionRunner.run(async () => {
      const created = await this.applicabilityRepository.create(
        input.requirementId,
        justification,
        input.actorUserId,
        declaredAt,
      );

      await this.auditRecorder.record({
        action: 'compliance.requirement_declared_not_applicable',
        entityType: AuditEntityType.REQUIREMENT_APPLICABILITY,
        entityId: created.id,
        actorLabel: actor.fullName,
        newValues: {
          requirementId: input.requirementId,
          justification,
          declaredAt,
        },
      });

      return created;
    });

    await this.complianceReader.deriveForOne(input.requirementId, declaredAt);

    return declaration;
  }
}
