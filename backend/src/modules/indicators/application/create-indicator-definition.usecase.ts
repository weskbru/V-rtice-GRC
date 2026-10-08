import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { EntityCodeGeneratorPort } from '../../../grc/shared/domain/ports/entity-code-generator.port';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { findIndicatorMetricCatalogEntry } from '../domain/indicator-metric-catalog';
import { IndicatorDefinitionRepositoryPort } from '../domain/ports/indicator-definition-repository.port';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import { assertIndicatorThresholdInvariant } from './assert-indicator-threshold-invariant';

import type { IndicatorOwnerRef } from './resolve-indicator-owner';
import type { IndicatorDefinitionRecord } from '../domain/indicator-definition.entity';
import type { IndicatorThresholdComparator } from '@prisma/client';

export interface CreateIndicatorDefinitionInput {
  readonly actorUserId: string;
  readonly metricKey: string;
  readonly name: string;
  readonly description: string;
  readonly ownerUserId: string;
  readonly thresholdComparator?: IndicatorThresholdComparator | undefined;
  readonly thresholdValue?: number | undefined;
}

export interface CreateIndicatorDefinitionResult {
  readonly record: IndicatorDefinitionRecord;
  readonly owner: IndicatorOwnerRef;
}

@Injectable()
export class CreateIndicatorDefinitionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly definitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly referenceData: IndicatorReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateIndicatorDefinitionInput): Promise<CreateIndicatorDefinitionResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const catalogEntry = findIndicatorMetricCatalogEntry(input.metricKey);
    if (!catalogEntry) {
      throw new ValidationDomainError(USER_MESSAGES.indicators.unknownMetricKey, [
        { field: 'metricKey', message: USER_MESSAGES.indicators.unknownMetricKey },
      ]);
    }

    const thresholdComparator = input.thresholdComparator ?? null;
    const thresholdValue = input.thresholdValue ?? null;
    assertIndicatorThresholdInvariant(thresholdComparator, thresholdValue);

    const existing = await this.definitionRepository.findByMetricKey(catalogEntry.metricKey);
    if (existing) {
      throw new ValidationDomainError(USER_MESSAGES.indicators.metricKeyAlreadyConfigured, [
        { field: 'metricKey', message: USER_MESSAGES.indicators.metricKeyAlreadyConfigured },
      ]);
    }

    const ownerLookup = await this.referenceData.findUser(input.ownerUserId);
    if (!ownerLookup?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.indicators.ownerNotFound, [
        { field: 'ownerUserId', message: USER_MESSAGES.indicators.ownerNotFound },
      ]);
    }

    const codeYear = new Date().getUTCFullYear();

    const record = await this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('IND', codeYear);

      const created = await this.definitionRepository.create({
        code,
        metricKey: catalogEntry.metricKey,
        name: input.name,
        description: input.description,
        ownerUserId: input.ownerUserId,
        thresholdComparator,
        thresholdValue,
        createdByUserId: input.actorUserId,
      });

      await this.auditRecorder.record({
        action: 'indicator.created',
        entityType: AuditEntityType.INDICATOR,
        entityId: created.id,
        actorLabel: actor.fullName,
        newValues: {
          code,
          metricKey: catalogEntry.metricKey,
          name: input.name,
          description: input.description,
          ownerUserId: input.ownerUserId,
          thresholdComparator,
          thresholdValue,
          isActive: true,
        },
      });

      return created;
    });

    return {
      record,
      owner: { id: ownerLookup.id, fullName: ownerLookup.fullName },
    };
  }
}
