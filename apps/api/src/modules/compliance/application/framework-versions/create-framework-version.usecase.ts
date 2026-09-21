/**
 * T023/004-compliance-management — `CreateFrameworkVersionUseCase`
 * (`POST /frameworks/{frameworkId}/versions`, `createFrameworkVersion`
 * operation, FR-002, FR-006). Every version is created `DRAFT`
 * (research.md D-3); creating one never alters or invalidates any other
 * version of the same framework (FR-006). `label` must be unique within
 * the framework (`422` otherwise).
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
import { FrameworkRepositoryPort } from '../../domain/ports/framework-repository.port';
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';

import type { FrameworkVersionRecord } from '../../domain/ports/framework-version-repository.port';

export interface CreateFrameworkVersionInput {
  readonly actorUserId: string;
  readonly frameworkId: string;
  readonly label: string;
}

@Injectable()
export class CreateFrameworkVersionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly frameworkRepository: FrameworkRepositoryPort,
    private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: CreateFrameworkVersionInput): Promise<FrameworkVersionRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const framework = await this.frameworkRepository.findById(input.frameworkId);
    if (!framework) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkEntityLabel,
        input.frameworkId,
      );
    }

    const existingByLabel = await this.frameworkVersionRepository.findByFrameworkAndLabel(
      input.frameworkId,
      input.label,
    );
    if (existingByLabel) {
      throw new ValidationDomainError(USER_MESSAGES.compliance.framework.versionLabelAlreadyUsed, [
        { field: 'label', message: USER_MESSAGES.compliance.framework.versionLabelAlreadyUsed },
      ]);
    }

    return this.transactionRunner.run(async () => {
      const record = await this.frameworkVersionRepository.create({
        frameworkId: input.frameworkId,
        label: input.label,
      });

      await this.auditRecorder.record({
        action: 'framework_version.created',
        entityType: AuditEntityType.FRAMEWORK_VERSION,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: { label: input.label, status: record.status },
      });

      return record;
    });
  }
}
