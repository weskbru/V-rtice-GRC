import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { NotFoundDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { unitScope } from '../../../shared/persistence/scope-filter';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import {
  actionTransitionEventName,
  assertLegalActionTransition,
  assertReopenReasonProvided,
} from '../domain/action.entity';
import { ActionReferenceDataPort } from '../domain/ports/action-reference-data.port';
import { ActionRepositoryPort } from '../domain/ports/action-repository.port';

import { assertActionOriginInScope } from './assert-action-origin-in-scope';

import type { ActionRecord, ActionTransitionChanges } from '../domain/ports/action-repository.port';
import type { ActionStatus } from '@prisma/client';

export interface TransitionActionInput {
  readonly actorUserId: string;
  readonly actionId: string;
  readonly to: ActionStatus;
  readonly reason?: string | undefined;
}

@Injectable()
export class TransitionActionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly actionRepository: ActionRepositoryPort,
    private readonly referenceData: ActionReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: TransitionActionInput): Promise<ActionRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const current = await this.actionRepository.findByIdUnscoped(input.actionId);
    if (!current) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
    }

    const origin = await assertActionOriginInScope(
      input.actorUserId,
      input.actionId,
      current.originType,
      current.originId,
    );

    assertLegalActionTransition(current.status, input.to);
    if (input.to === 'OPEN') {
      assertReopenReasonProvided(input.reason);
    }

    const now = new Date();
    const changes: ActionTransitionChanges = {
      status: input.to,
      completedAt: input.to === 'COMPLETED' ? now : null,
      completedByUserId: input.to === 'COMPLETED' ? input.actorUserId : null,
      reopenedAt: input.to === 'OPEN' ? now : null,
      reopenedByUserId: input.to === 'OPEN' ? input.actorUserId : null,
      reopenReason: input.to === 'OPEN' ? (input.reason ?? null) : null,
    };

    const rowScope = unitScope([current.orgUnit.id]);

    return this.transactionRunner.run(async () => {
      const updated = await this.actionRepository.transition(rowScope, input.actionId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
      }

      await this.auditRecorder.record({
        action: actionTransitionEventName(input.to),
        entityType: AuditEntityType.ACTION,
        entityId: input.actionId,
        actorLabel: actor.fullName,
        previousValues: {
          status: current.status,
          completedAt: current.completedAt ?? null,
          completedByUserId: current.completedByUserId ?? null,
        },
        newValues: {
          status: updated.status,
          completedAt: updated.completedAt ?? null,
          completedByUserId: updated.completedByUserId ?? null,
          reopenedAt: updated.reopenedAt ?? null,
          reopenedByUserId: updated.reopenedByUserId ?? null,
          reopenReason: updated.reopenReason ?? null,
        },
        organizationalUnitId: origin.organizationalUnitId,
      });

      return updated;
    });
  }
}
