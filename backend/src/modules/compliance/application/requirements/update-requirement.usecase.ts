import { Injectable } from '@nestjs/common';
import { AuditEntityType, AuditOutcome } from '@prisma/client';

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
import { ComplianceReferenceDataPort } from '../../domain/ports/compliance-reference-data.port';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';
import { isRequirementEditable } from '../../domain/requirement.entity';
import { RequirementComplianceReaderService } from '../requirement-compliance-reader.service';

import type { RequirementRecord } from '../../domain/ports/requirement-repository.port';

export interface UpdateRequirementInput {
  readonly actorUserId: string;
  readonly requirementId: string;
  readonly expectedVersion: number;
  readonly externalRef?: string | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
}

@Injectable()
export class UpdateRequirementUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
    private readonly complianceReader: RequirementComplianceReaderService,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: UpdateRequirementInput): Promise<RequirementRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const current = await this.requirementRepository.findById(input.requirementId);
    if (!current) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.requirementEntityLabel,
        input.requirementId,
      );
    }

    if (!isRequirementEditable(current.frameworkVersion.status)) {
      await this.auditRefusedAttempt(input, current, actor.fullName);
      throw new ValidationDomainError(USER_MESSAGES.compliance.requirement.parentVersionNotDraft, [
        {
          field: 'externalRef',
          message: USER_MESSAGES.compliance.requirement.parentVersionNotDraft,
        },
      ]);
    }

    const changes: { externalRef?: string; title?: string; description?: string } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.externalRef !== undefined && input.externalRef !== current.externalRef) {
      changes.externalRef = input.externalRef;
      previousValues.externalRef = current.externalRef;
      newValues.externalRef = input.externalRef;
    }
    if (input.title !== undefined && input.title !== current.title) {
      changes.title = input.title;
      previousValues.title = current.title;
      newValues.title = input.title;
    }
    if (input.description !== undefined && input.description !== current.description) {
      changes.description = input.description;
      previousValues.description = current.description;
      newValues.description = input.description;
    }

    const referenceDate = new Date();

    const row = await this.transactionRunner.run(async () => {
      const result = await this.requirementRepository.updateWithVersion(
        input.requirementId,
        input.expectedVersion,
        changes,
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(
          USER_MESSAGES.compliance.requirementEntityLabel,
          input.requirementId,
        );
      }
      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          USER_MESSAGES.compliance.requirementEntityLabel,
          input.requirementId,
          input.expectedVersion,
          result.currentVersion,
        );
      }

      if (Object.keys(newValues).length > 0) {
        await this.auditRecorder.record({
          action: 'requirement.updated',
          entityType: AuditEntityType.REQUIREMENT,
          entityId: input.requirementId,
          actorLabel: actor.fullName,
          previousValues,
          newValues,
        });
      }

      return result.row;
    });

    const derived = await this.complianceReader.deriveForOne(row.id, referenceDate);
    return { ...row, ...derived };
  }

  private async auditRefusedAttempt(
    input: UpdateRequirementInput,
    current: { readonly externalRef: string; readonly title: string; readonly description: string },
    actorLabel: string,
  ): Promise<void> {
    const attemptedPreviousValues: Record<string, unknown> = {};
    const attemptedNewValues: Record<string, unknown> = {};

    if (input.externalRef !== undefined) {
      attemptedPreviousValues.externalRef = current.externalRef;
      attemptedNewValues.externalRef = input.externalRef;
    }
    if (input.title !== undefined) {
      attemptedPreviousValues.title = current.title;
      attemptedNewValues.title = input.title;
    }
    if (input.description !== undefined) {
      attemptedPreviousValues.description = current.description;
      attemptedNewValues.description = input.description;
    }

    await this.transactionRunner.run(async () => {
      await this.auditRecorder.record({
        action: 'requirement.update_refused',
        entityType: AuditEntityType.REQUIREMENT,
        entityId: input.requirementId,
        actorLabel,
        previousValues: attemptedPreviousValues,
        newValues: attemptedNewValues,
        outcome: AuditOutcome.FAILURE,
      });
    });
  }
}
