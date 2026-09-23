import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { IndicatorDefinitionRepositoryPort } from '../domain/ports/indicator-definition-repository.port';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import { assertIndicatorThresholdInvariant } from './assert-indicator-threshold-invariant';
import { resolveIndicatorOwnerRef, type IndicatorOwnerRef } from './resolve-indicator-owner';

import type { IndicatorDefinitionRecord } from '../domain/indicator-definition.entity';
import type { UpdateIndicatorDefinitionChanges } from '../domain/ports/indicator-definition-repository.port';
import type { IndicatorThresholdComparator } from '@prisma/client';

export interface UpdateIndicatorDefinitionInput {
  readonly actorUserId: string;
  readonly definitionId: string;
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly ownerUserId?: string | undefined;
  readonly thresholdComparator?: IndicatorThresholdComparator | null | undefined;
  readonly thresholdValue?: number | null | undefined;
  readonly isActive?: boolean | undefined;
}

export interface UpdateIndicatorDefinitionResult {
  readonly record: IndicatorDefinitionRecord;
  readonly owner: IndicatorOwnerRef;
}

@Injectable()
export class UpdateIndicatorDefinitionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly definitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly referenceData: IndicatorReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: UpdateIndicatorDefinitionInput): Promise<UpdateIndicatorDefinitionResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const current = await this.definitionRepository.findById(input.definitionId);
    if (!current) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, input.definitionId);
    }

    const finalThresholdComparator =
      input.thresholdComparator !== undefined
        ? input.thresholdComparator
        : current.thresholdComparator;
    const finalThresholdValue =
      input.thresholdValue !== undefined ? input.thresholdValue : current.thresholdValue;
    assertIndicatorThresholdInvariant(finalThresholdComparator, finalThresholdValue);

    const changes: {
      -readonly [K in keyof UpdateIndicatorDefinitionChanges]: UpdateIndicatorDefinitionChanges[K];
    } = {};
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

    let ownerRef: IndicatorOwnerRef | undefined;
    if (input.ownerUserId !== undefined && input.ownerUserId !== current.ownerUserId) {
      const owner = await this.referenceData.findUser(input.ownerUserId);
      if (!owner?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.indicators.ownerNotFound, [
          { field: 'ownerUserId', message: USER_MESSAGES.indicators.ownerNotFound },
        ]);
      }
      changes.ownerUserId = input.ownerUserId;
      previousValues.ownerUserId = current.ownerUserId;
      newValues.ownerUserId = input.ownerUserId;
      ownerRef = { id: owner.id, fullName: owner.fullName };
    }

    if (
      input.thresholdComparator !== undefined &&
      input.thresholdComparator !== current.thresholdComparator
    ) {
      changes.thresholdComparator = input.thresholdComparator;
      previousValues.thresholdComparator = current.thresholdComparator;
      newValues.thresholdComparator = input.thresholdComparator;
    }

    if (input.thresholdValue !== undefined && input.thresholdValue !== current.thresholdValue) {
      changes.thresholdValue = input.thresholdValue;
      previousValues.thresholdValue = current.thresholdValue;
      newValues.thresholdValue = input.thresholdValue;
    }

    if (input.isActive !== undefined && input.isActive !== current.isActive) {
      changes.isActive = input.isActive;
      previousValues.isActive = current.isActive;
      newValues.isActive = input.isActive;
    }

    if (Object.keys(changes).length === 0) {
      const owner =
        ownerRef ?? (await resolveIndicatorOwnerRef(this.referenceData, current.ownerUserId));
      return { record: current, owner };
    }

    const record = await this.transactionRunner.run(async () => {
      const updated = await this.definitionRepository.update(input.definitionId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, input.definitionId);
      }

      await this.auditRecorder.record({
        action: 'indicator.updated',
        entityType: AuditEntityType.INDICATOR,
        entityId: input.definitionId,
        actorLabel: actor.fullName,
        previousValues,
        newValues,
      });

      return updated;
    });

    const owner =
      ownerRef ?? (await resolveIndicatorOwnerRef(this.referenceData, record.ownerUserId));
    return { record, owner };
  }
}
