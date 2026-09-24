import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { unitScope } from '../../../shared/persistence/scope-filter';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { parseIsoDate } from '../../shared/domain/iso-date';
import { ActionReferenceDataPort } from '../domain/ports/action-reference-data.port';
import { ActionRepositoryPort } from '../domain/ports/action-repository.port';

import { assertActionOriginInScope } from './assert-action-origin-in-scope';

import type { ActionRecord, UpdateActionChanges } from '../domain/ports/action-repository.port';

export interface UpdateActionInput {
  readonly actorUserId: string;
  readonly actionId: string;
  readonly title?: string | undefined;
  readonly description?: string | null | undefined;
  readonly responsibleUserId?: string | undefined;
  readonly dueOn?: string | undefined;
}

@Injectable()
export class UpdateActionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly actionRepository: ActionRepositoryPort,
    private readonly referenceData: ActionReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: UpdateActionInput): Promise<ActionRecord> {
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

    const changes: { -readonly [K in keyof UpdateActionChanges]: UpdateActionChanges[K] } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.title !== undefined && input.title !== current.title) {
      changes.title = input.title;
      previousValues.title = current.title;
      newValues.title = input.title;
    }

    if (input.description !== undefined && input.description !== (current.description ?? null)) {
      changes.description = input.description;
      previousValues.description = current.description ?? null;
      newValues.description = input.description;
    }

    if (
      input.responsibleUserId !== undefined &&
      input.responsibleUserId !== current.responsible.id
    ) {
      const responsible = await this.referenceData.findUser(input.responsibleUserId);
      if (!responsible?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.action.responsibleNotFound, [
          { field: 'responsibleUserId', message: USER_MESSAGES.action.responsibleNotFound },
        ]);
      }
      changes.responsibleUserId = input.responsibleUserId;
      previousValues.responsibleUserId = current.responsible.id;
      newValues.responsibleUserId = input.responsibleUserId;
    }

    if (input.dueOn !== undefined) {
      const parsed = parseIsoDate(input.dueOn);
      if (parsed.getTime() !== current.dueOn.getTime()) {
        changes.dueOn = parsed;
        previousValues.dueOn = current.dueOn;
        newValues.dueOn = parsed;
      }
    }

    if (Object.keys(changes).length === 0) {
      return current;
    }

    const rowScope = unitScope([current.orgUnit.id]);

    return this.transactionRunner.run(async () => {
      const updated = await this.actionRepository.update(rowScope, input.actionId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
      }

      await this.auditRecorder.record({
        action: 'action.updated',
        entityType: AuditEntityType.ACTION,
        entityId: input.actionId,
        actorLabel: actor.fullName,
        previousValues,
        newValues,
        organizationalUnitId: origin.organizationalUnitId,
      });

      return updated;
    });
  }
}
