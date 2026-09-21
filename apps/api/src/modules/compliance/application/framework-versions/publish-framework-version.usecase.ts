/**
 * T023/004-compliance-management — `PublishFrameworkVersionUseCase`
 * (`POST /frameworks/{frameworkId}/versions/{versionId}/publish`,
 * `publishFrameworkVersion` operation, FR-005, research.md D-3). The
 * version's one legal transition, one-way — there is deliberately no
 * operation to revert it.
 *
 * Refused with `422` when the version has no requirement at all (FR-005,
 * edge case "versão publicada sem cláusulas") — a version with nothing to
 * measure would count, incorrectly, as 100% compliant. Refused with `422`
 * when already `PUBLISHED`.
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
import { canPublishFrameworkVersion } from '../../domain/framework-version-lifecycle';
import { ComplianceReferenceDataPort } from '../../domain/ports/compliance-reference-data.port';
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';

import type { FrameworkVersionRecord } from '../../domain/ports/framework-version-repository.port';

export interface PublishFrameworkVersionInput {
  readonly actorUserId: string;
  readonly frameworkId: string;
  readonly versionId: string;
  /** From the `If-Match` header (ADR-013). */
  readonly expectedVersion: number;
}

@Injectable()
export class PublishFrameworkVersionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: PublishFrameworkVersionInput): Promise<FrameworkVersionRecord> {
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

    if (!canPublishFrameworkVersion(current.status)) {
      throw new ValidationDomainError(USER_MESSAGES.compliance.frameworkVersion.alreadyPublished, [
        { field: 'status', message: USER_MESSAGES.compliance.frameworkVersion.alreadyPublished },
      ]);
    }

    const requirementCount = await this.frameworkVersionRepository.countRequirements(
      input.versionId,
    );
    if (requirementCount === 0) {
      throw new ValidationDomainError(
        USER_MESSAGES.compliance.frameworkVersion.publishRequiresAtLeastOneRequirement,
        [
          {
            field: 'status',
            message: USER_MESSAGES.compliance.frameworkVersion.publishRequiresAtLeastOneRequirement,
          },
        ],
      );
    }

    const publishedAt = new Date();

    return this.transactionRunner.run(async () => {
      const result = await this.frameworkVersionRepository.publishWithVersion(
        input.versionId,
        input.expectedVersion,
        { publishedAt, publishedByUserId: input.actorUserId },
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

      await this.auditRecorder.record({
        action: 'framework_version.updated',
        entityType: AuditEntityType.FRAMEWORK_VERSION,
        entityId: input.versionId,
        actorLabel: actor.fullName,
        previousValues: { status: current.status },
        newValues: {
          status: result.record.status,
          publishedAt: result.record.publishedAt,
          publishedByUserId: input.actorUserId,
        },
      });

      return result.record;
    });
  }
}
