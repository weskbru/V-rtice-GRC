import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { NotificationService } from '../../../core/notifications/application/notification.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  ForbiddenDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { findIndicatorMetricCatalogEntry } from '../domain/indicator-metric-catalog';
import { IndicatorDefinitionRepositoryPort } from '../domain/ports/indicator-definition-repository.port';
import { IndicatorMeasurementRepositoryPort } from '../domain/ports/indicator-measurement-repository.port';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import { IndicatorCalculationService } from './indicator-calculation.service';

import type { IndicatorOwnerRef } from './resolve-indicator-owner';
import type { IndicatorMeasurementRecord } from '../domain/indicator-measurement.entity';

export interface CreateIndicatorMeasurementInput {
  readonly actorUserId: string;
  readonly metricKey: string;
}

export interface CreateIndicatorMeasurementResult {
  readonly record: IndicatorMeasurementRecord;
  readonly computedBy: IndicatorOwnerRef;
}

@Injectable()
export class CreateIndicatorMeasurementUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly definitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly measurementRepository: IndicatorMeasurementRepositoryPort,
    private readonly referenceData: IndicatorReferenceDataPort,
    private readonly calculationService: IndicatorCalculationService,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(input: CreateIndicatorMeasurementInput): Promise<CreateIndicatorMeasurementResult> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    if (scope.kind !== 'GLOBAL') {
      throw new ForbiddenDomainError(USER_MESSAGES.indicators.measurementRequiresGlobalScope);
    }

    const catalogEntry = findIndicatorMetricCatalogEntry(input.metricKey);
    if (!catalogEntry) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.metricKeyEntityLabel, input.metricKey);
    }

    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const definitionRecord = await this.definitionRepository.findByMetricKey(
      catalogEntry.metricKey,
    );

    const record = await this.transactionRunner.run(async () => {
      const result = await this.calculationService.calculate({
        metricKey: catalogEntry.metricKey,
        scope,
        definition: definitionRecord,
      });

      const created = await this.measurementRepository.create({
        metricKey: catalogEntry.metricKey,
        value: result.value ?? null,
        valueByBucket: result.valueByBucket ? { ...result.valueByBucket } : null,
        breached: result.breached,
        computedByUserId: input.actorUserId,
      });

      await this.auditRecorder.record({
        action: 'indicator_measurement.created',
        entityType: AuditEntityType.INDICATOR_MEASUREMENT,
        entityId: created.id,
        actorLabel: actor.fullName,
        newValues: {
          metricKey: created.metricKey,
          value: created.value,
          valueByBucket: created.valueByBucket,
          breached: created.breached,
          computedByUserId: created.computedByUserId,
        },
      });

      if (created.breached) {
        await this.notificationService.notify({
          recipientUserId: definitionRecord!.ownerUserId,
          type: 'indicator.threshold.breached',
          title: USER_MESSAGES.indicators.thresholdBreachedTitle(definitionRecord!.name),
          body: USER_MESSAGES.indicators.thresholdBreachedBody(
            definitionRecord!.name,
            String(created.value),
          ),
          entityType: 'INDICATOR',
          entityId: definitionRecord!.id,
        });
      }

      return created;
    });

    return {
      record,
      computedBy: { id: actor.id, fullName: actor.fullName },
    };
  }
}
