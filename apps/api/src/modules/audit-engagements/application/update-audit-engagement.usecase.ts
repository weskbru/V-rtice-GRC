/**
 * T027/005-audit-findings, User Story 1 — `UpdateAuditEngagementUseCase`:
 * partial descriptive-field update (`PATCH /audits/{auditId}`,
 * `updateAuditEngagement` operation), permitted only while `PLANNING`
 * (research.md D-3/D-13) and optimistic-lock conflict detection
 * (research.md D-18). Mirrors `modules/controls/application/update-control.usecase.ts`'s
 * structure — see that file's header for the transaction-boundary
 * reasoning this one does not repeat.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { registerAuditEngagementAuditAllowlists } from '../domain/audit-engagement-audit-allowlist';
import {
  assertAuditEngagementEditable,
  assertPeriodEndNotBeforeStart,
} from '../domain/audit-engagement.entity';
import { AuditEngagementReferenceDataPort } from '../domain/ports/audit-engagement-reference-data.port';
import { AuditEngagementRepositoryPort } from '../domain/ports/audit-engagement-repository.port';

import { AuditEngagementAccessResolver } from './audit-engagement-access-resolver.service';
import { isOrgUnitWithinScope } from './create-audit-engagement.usecase';

import type {
  UpdateAuditEngagementChanges,
  AuditEngagementRecord,
} from '../domain/ports/audit-engagement-repository.port';

export interface UpdateAuditEngagementInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
  /** From the `If-Match` header (research.md D-18). */
  readonly expectedVersion: number;
  readonly objective?: string | undefined;
  readonly periodStart?: Date | undefined;
  readonly periodEnd?: Date | undefined;
  readonly orgUnitId?: string | undefined;
  readonly leadAuditorUserId?: string | undefined;
}

@Injectable()
export class UpdateAuditEngagementUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditEngagementRepository: AuditEngagementRepositoryPort,
    private readonly referenceData: AuditEngagementReferenceDataPort,
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerAuditEngagementAuditAllowlists();
  }

  async execute(input: UpdateAuditEngagementInput): Promise<AuditEngagementRecord> {
    const actor = await this.accessResolver.resolveActor(input.actorUserId);
    const { scope, auditEngagement: current } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );

    assertAuditEngagementEditable(current.status);

    const changes: {
      -readonly [K in keyof UpdateAuditEngagementChanges]: UpdateAuditEngagementChanges[K];
    } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.objective !== undefined && input.objective !== current.objective) {
      changes.objective = input.objective;
      previousValues.objective = current.objective;
      newValues.objective = input.objective;
    }

    const finalPeriodStart = input.periodStart ?? current.periodStart;
    const finalPeriodEnd = input.periodEnd ?? current.periodEnd;
    if (input.periodStart !== undefined || input.periodEnd !== undefined) {
      assertPeriodEndNotBeforeStart(finalPeriodStart, finalPeriodEnd);
    }
    if (
      input.periodStart !== undefined &&
      input.periodStart.getTime() !== current.periodStart.getTime()
    ) {
      changes.periodStart = input.periodStart;
      previousValues.periodStart = current.periodStart;
      newValues.periodStart = input.periodStart;
    }
    if (
      input.periodEnd !== undefined &&
      input.periodEnd.getTime() !== current.periodEnd.getTime()
    ) {
      changes.periodEnd = input.periodEnd;
      previousValues.periodEnd = current.periodEnd;
      newValues.periodEnd = input.periodEnd;
    }

    if (input.orgUnitId !== undefined && input.orgUnitId !== current.orgUnit.id) {
      const orgUnit = await this.referenceData.findOrgUnit(input.orgUnitId);
      if (!orgUnit?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.auditEngagements.orgUnitNotFound, [
          { field: 'orgUnitId', message: USER_MESSAGES.auditEngagements.orgUnitNotFound },
        ]);
      }
      if (!isOrgUnitWithinScope(scope, input.orgUnitId)) {
        throw new ValidationDomainError(USER_MESSAGES.auditEngagements.orgUnitOutOfScope, [
          { field: 'orgUnitId', message: USER_MESSAGES.auditEngagements.orgUnitOutOfScope },
        ]);
      }
      changes.orgUnitId = input.orgUnitId;
      previousValues.orgUnitId = current.orgUnit.id;
      newValues.orgUnitId = input.orgUnitId;
    }

    if (
      input.leadAuditorUserId !== undefined &&
      input.leadAuditorUserId !== current.leadAuditor.id
    ) {
      const leadAuditor = await this.referenceData.findUser(input.leadAuditorUserId);
      if (!leadAuditor?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.auditEngagements.leadAuditorNotFound, [
          {
            field: 'leadAuditorUserId',
            message: USER_MESSAGES.auditEngagements.leadAuditorNotFound,
          },
        ]);
      }
      changes.leadAuditorUserId = input.leadAuditorUserId;
      previousValues.leadAuditorUserId = current.leadAuditor.id;
      newValues.leadAuditorUserId = input.leadAuditorUserId;
    }

    return this.transactionRunner.run(async () => {
      const result = await this.auditEngagementRepository.updateWithVersion(
        scope,
        input.auditEngagementId,
        input.expectedVersion,
        changes,
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(
          USER_MESSAGES.auditEngagements.entityLabel,
          input.auditEngagementId,
        );
      }

      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          USER_MESSAGES.auditEngagements.entityLabel,
          input.auditEngagementId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      // Only audit when something actually changed — an idempotent PATCH
      // re-submitting the current values still succeeds (200), but leaves
      // no misleading "nothing changed" audit row (same discipline
      // `UpdateControlUseCase` documents).
      if (Object.keys(newValues).length > 0) {
        await this.auditRecorder.record({
          action: 'audit_engagement.updated',
          entityType: AuditEntityType.AUDIT_ENGAGEMENT,
          entityId: input.auditEngagementId,
          actorLabel: actor.fullName,
          previousValues,
          newValues,
          organizationalUnitId: result.record.orgUnit.id,
        });
      }

      return result.record;
    });
  }
}
