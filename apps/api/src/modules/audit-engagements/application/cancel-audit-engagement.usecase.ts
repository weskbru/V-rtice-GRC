/**
 * T034a/005-audit-findings, User Story 1 — `CancelAuditEngagementUseCase`,
 * the discard path FR-004a added at the analysis gate (data-model.md's own
 * amendment, `audit-engagement.entity.ts`'s header). Reachable from
 * `PLANNING` **and** `IN_PROGRESS` (`PLANNING -> CANCELLED`,
 * `IN_PROGRESS -> CANCELLED`), requires a written justification, and is
 * terminal — a cancelled engagement accepts no new finding either
 * (`assertAuditEngagementAcceptsFindings` refuses any status but
 * `IN_PROGRESS`, `CANCELLED` included).
 *
 * Not part of `contracts/audit.openapi.yaml` as written — that contract
 * predates FR-004a's correction note and needs its own amendment
 * (`POST /audits/{auditId}/cancel`, mirroring `start`/`complete`'s own
 * shape) before a controller can expose this use case; see this task's own
 * report for the exact operation to add. The use case itself does not wait
 * for that: FR-004a is a functional requirement, not a documentation
 * requirement, and shipping the operation without a caller able to reach
 * it would be the same "exists but never executed" gap CLAUDE.md §19.10
 * warns against — this file's own reachability is proven by
 * `test/integration/audit-engagement-lifecycle.spec.ts`, not by an HTTP
 * route.
 */
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
import {
  assertCancellationJustificationProvided,
  assertLegalAuditEngagementTransition,
} from '../domain/audit-engagement.entity';
import { AuditEngagementRepositoryPort } from '../domain/ports/audit-engagement-repository.port';

import { AuditEngagementAccessResolver } from './audit-engagement-access-resolver.service';

import type { AuditEngagementRecord } from '../domain/ports/audit-engagement-repository.port';

export interface CancelAuditEngagementInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
  readonly justification: string;
  /** From the `If-Match` header (research.md D-18) — same optimistic-lock
   * discipline as `start`/`complete`. */
  readonly expectedVersion: number;
}

@Injectable()
export class CancelAuditEngagementUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditEngagementRepository: AuditEngagementRepositoryPort,
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerAuditEngagementAuditAllowlists();
  }

  async execute(input: CancelAuditEngagementInput): Promise<AuditEngagementRecord> {
    const actor = await this.accessResolver.resolveActor(input.actorUserId);
    const { scope, auditEngagement: current } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );

    // Legal from PLANNING or IN_PROGRESS; refused from COMPLETED/CANCELLED
    // (both already terminal) — the lifecycle table itself is the single
    // source of truth for which origins are legal, never re-derived here.
    assertLegalAuditEngagementTransition(current.status, 'CANCELLED');
    assertCancellationJustificationProvided(input.justification);

    const cancelledAt = new Date();

    return this.transactionRunner.run(async () => {
      const result = await this.auditEngagementRepository.applyLifecycleTransition(
        scope,
        input.auditEngagementId,
        input.expectedVersion,
        {
          status: 'CANCELLED',
          cancelledAt,
          cancelledByUserId: input.actorUserId,
          cancellationJustification: input.justification,
        },
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
        action: 'audit_engagement.cancelled',
        entityType: AuditEntityType.AUDIT_ENGAGEMENT,
        entityId: input.auditEngagementId,
        actorLabel: actor.fullName,
        previousValues: { status: current.status },
        newValues: {
          status: result.record.status,
          cancelledAt,
          cancelledByUserId: input.actorUserId,
          cancellationJustification: input.justification,
        },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return result.record;
    });
  }
}
