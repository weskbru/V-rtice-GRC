import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
} from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { registerComplianceAuditAllowlists } from '../../domain/compliance-audit-allowlist';
import { ComplianceReferenceDataPort } from '../../domain/ports/compliance-reference-data.port';
import { FrameworkRepositoryPort } from '../../domain/ports/framework-repository.port';

import type { FrameworkRecord } from '../../domain/framework.entity';
import type { UpdateFrameworkChanges } from '../../domain/ports/framework-repository.port';
import type { FrameworkOrigin } from '@prisma/client';

export interface UpdateFrameworkInput {
  readonly actorUserId: string;
  readonly frameworkId: string;
  readonly expectedVersion: number;
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly origin?: FrameworkOrigin | undefined;
}

@Injectable()
export class UpdateFrameworkUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly frameworkRepository: FrameworkRepositoryPort,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: UpdateFrameworkInput): Promise<FrameworkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const current = await this.frameworkRepository.findById(input.frameworkId);
    if (!current) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkEntityLabel,
        input.frameworkId,
      );
    }

    const changes: { -readonly [K in keyof UpdateFrameworkChanges]: UpdateFrameworkChanges[K] } =
      {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.name !== undefined && input.name !== current.name) {
      changes.name = input.name;
      previousValues.name = current.name;
      newValues.name = input.name;
    }
    if (input.description !== undefined && input.description !== current.description) {
      changes.description = input.description;
      previousValues.description = current.description;
      newValues.description = input.description;
    }
    if (input.origin !== undefined && input.origin !== current.origin) {
      changes.origin = input.origin;
      previousValues.origin = current.origin;
      newValues.origin = input.origin;
    }

    return this.transactionRunner.run(async () => {
      const result = await this.frameworkRepository.updateWithVersion(
        input.frameworkId,
        input.expectedVersion,
        changes,
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(
          USER_MESSAGES.compliance.frameworkEntityLabel,
          input.frameworkId,
        );
      }
      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          USER_MESSAGES.compliance.frameworkEntityLabel,
          input.frameworkId,
          input.expectedVersion,
          result.currentVersion,
        );
      }

      if (Object.keys(newValues).length > 0) {
        await this.auditRecorder.record({
          action: 'framework.updated',
          entityType: AuditEntityType.FRAMEWORK,
          entityId: input.frameworkId,
          actorLabel: actor.fullName,
          previousValues,
          newValues,
        });
      }

      return result.record;
    });
  }
}
