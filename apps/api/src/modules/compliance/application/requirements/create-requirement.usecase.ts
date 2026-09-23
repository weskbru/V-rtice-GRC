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
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';
import { isRequirementEditable } from '../../domain/requirement.entity';
import { RequirementComplianceReaderService } from '../requirement-compliance-reader.service';

import type { RequirementRecord } from '../../domain/ports/requirement-repository.port';

export interface CreateRequirementInput {
  readonly actorUserId: string;
  readonly frameworkId: string;
  readonly versionId: string;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
}

@Injectable()
export class CreateRequirementUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort,
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
    private readonly complianceReader: RequirementComplianceReaderService,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: CreateRequirementInput): Promise<RequirementRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const version = await this.frameworkVersionRepository.findById(input.versionId);
    if (version?.framework.id !== input.frameworkId) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkVersionEntityLabel,
        input.versionId,
      );
    }

    if (!isRequirementEditable(version.status)) {
      throw new ValidationDomainError(USER_MESSAGES.compliance.requirement.parentVersionNotDraft, [
        {
          field: 'externalRef',
          message: USER_MESSAGES.compliance.requirement.parentVersionNotDraft,
        },
      ]);
    }

    const referenceDate = new Date();

    const row = await this.transactionRunner.run(async () => {
      const created = await this.requirementRepository.create({
        frameworkVersionId: input.versionId,
        externalRef: input.externalRef,
        title: input.title,
        description: input.description,
        createdByUserId: input.actorUserId,
      });

      await this.auditRecorder.record({
        action: 'requirement.created',
        entityType: AuditEntityType.REQUIREMENT,
        entityId: created.id,
        actorLabel: actor.fullName,
        newValues: {
          externalRef: input.externalRef,
          title: input.title,
          description: input.description,
        },
      });

      return created;
    });

    const derived = await this.complianceReader.deriveForOne(row.id, referenceDate);
    return { ...row, ...derived };
  }
}
