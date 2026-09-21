/**
 * T023/004-compliance-management — `UpdateFrameworkVersionUseCase`:
 * updates a version's `label`, only while `DRAFT` (`PATCH
 * /frameworks/{frameworkId}/versions/{versionId}`, `updateFrameworkVersion`
 * operation, FR-006). Refused with `422` once `PUBLISHED` — publishing
 * fixes the version's own identity, not only its requirements'.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { registerComplianceAuditAllowlists } from '../../domain/compliance-audit-allowlist';
import { isFrameworkVersionEditable } from '../../domain/framework-version-lifecycle';
import { ComplianceReferenceDataPort } from '../../domain/ports/compliance-reference-data.port';
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';

import type { FrameworkVersionRecord } from '../../domain/ports/framework-version-repository.port';

export interface UpdateFrameworkVersionInput {
  readonly actorUserId: string;
  readonly frameworkId: string;
  readonly versionId: string;
  /** From the `If-Match` header (ADR-013). */
  readonly expectedVersion: number;
  readonly label: string;
}

@Injectable()
export class UpdateFrameworkVersionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: UpdateFrameworkVersionInput): Promise<FrameworkVersionRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const current = await this.frameworkVersionRepository.findById(input.versionId);
    if (current?.framework.id !== input.frameworkId) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkVersionEntityLabel,
        input.versionId,
      );
    }

    if (!isFrameworkVersionEditable(current.status)) {
      throw new ValidationDomainError(
        USER_MESSAGES.compliance.frameworkVersion.notEditableAfterPublish,
        [
          {
            field: 'label',
            message: USER_MESSAGES.compliance.frameworkVersion.notEditableAfterPublish,
          },
        ],
      );
    }

    if (input.label !== current.label) {
      const existingByLabel = await this.frameworkVersionRepository.findByFrameworkAndLabel(
        input.frameworkId,
        input.label,
        input.versionId,
      );
      if (existingByLabel) {
        throw new ValidationDomainError(
          USER_MESSAGES.compliance.framework.versionLabelAlreadyUsed,
          [{ field: 'label', message: USER_MESSAGES.compliance.framework.versionLabelAlreadyUsed }],
        );
      }
    }

    return this.transactionRunner.run(async () => {
      const result = await this.frameworkVersionRepository.updateLabelWithVersion(
        input.versionId,
        input.expectedVersion,
        { label: input.label },
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(
          USER_MESSAGES.compliance.frameworkVersionEntityLabel,
          input.versionId,
        );
      }
      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          USER_MESSAGES.compliance.frameworkVersionEntityLabel,
          input.versionId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      if (input.label !== current.label) {
        await this.auditRecorder.record({
          action: 'framework_version.updated',
          entityType: AuditEntityType.FRAMEWORK_VERSION,
          entityId: input.versionId,
          actorLabel: actor.fullName,
          previousValues: { label: current.label },
          newValues: { label: input.label },
        });
      }

      return result.record;
    });
  }
}
