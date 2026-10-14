import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { registerAuditEngagementAuditAllowlists } from '../domain/audit-engagement-audit-allowlist';
import { assertLegalAuditEngagementTransition } from '../domain/audit-engagement.entity';
import { AuditEngagementRepositoryPort } from '../domain/ports/audit-engagement-repository.port';

import { AuditEngagementAccessResolver } from './audit-engagement-access-resolver.service';

import type { AuditEngagementRecord } from '../domain/ports/audit-engagement-repository.port';

export interface CompleteAuditEngagementInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
  readonly expectedVersion: number;
}

@Injectable()
export class CompleteAuditEngagementUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditEngagementRepository: AuditEngagementRepositoryPort,
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerAuditEngagementAuditAllowlists();
  }

  async execute(input: CompleteAuditEngagementInput): Promise<AuditEngagementRecord> {
    const actor = await this.accessResolver.resolveActor(input.actorUserId);
    const { scope, auditEngagement: current } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );

    assertLegalAuditEngagementTransition(current.status, 'COMPLETED');

    const completedAt = new Date();

    return this.transactionRunner.run(async () => {
      const result = await this.auditEngagementRepository.applyLifecycleTransition(
        scope,
        input.auditEngagementId,
        input.expectedVersion,
        { status: 'COMPLETED', completedAt, completedByUserId: input.actorUserId },
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

      await this.auditRecorder.record({
        action: 'audit_engagement.completed',
        entityType: AuditEntityType.AUDIT_ENGAGEMENT,
        entityId: input.auditEngagementId,
        actorLabel: actor.fullName,
        previousValues: { status: current.status },
        newValues: {
          status: result.record.status,
          completedAt,
          completedByUserId: input.actorUserId,
        },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return result.record;
    });
  }
}
