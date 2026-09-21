/**
 * T027/004-compliance-management — `UpdateRequirementUseCase` (`PATCH
 * /requirements/{requirementId}`, `updateRequirement` operation, FR-004).
 * Permitted only while the parent version is `DRAFT`; refused with `422`
 * once `PUBLISHED` — enforced both here AND by the
 * `requirements_immutable_after_publish` database trigger (research.md
 * D-4, T006), which is the actual guarantee, not this check.
 *
 * ## FR-004's second half: "a tentativa é auditada"
 *
 * Unlike an ordinary validation refusal (which throws without writing
 * anything), FR-004 and US1 AS2 explicitly require that a REFUSED edit
 * attempt itself lands in the audit trail ("a alteração é recusada e a
 * trilha registra a tentativa"). `AuditRecorder.record(...)` only writes
 * inside an ambient transaction (ADR-005) — this use case opens ONE via
 * `TransactionRunnerPort.run(...)` for exactly that single audit insert,
 * lets it commit, and only THEN throws `ValidationDomainError` from
 * outside that closure — mirroring the "short-lived, audit-only
 * transaction" pattern `AuditPermissionDenialRecorder`'s own header
 * documents for the identical structural problem (a refusal that must
 * survive the very error it accompanies). A transaction that also threw
 * the domain error from inside it would roll back its own audit insert,
 * which is exactly the outcome FR-004 forbids.
 */
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
  /** From the `If-Match` header (ADR-013). */
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

  /** FR-004's own "a tentativa é auditada" — see this file's header for
   * why this is a separate, already-committed transaction rather than a
   * write inside the one the caller's refusal would otherwise roll back. */
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
