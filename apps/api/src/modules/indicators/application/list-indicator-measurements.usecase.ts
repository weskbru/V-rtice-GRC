import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ForbiddenDomainError, NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { findIndicatorMetricCatalogEntry } from '../domain/indicator-metric-catalog';
import { IndicatorMeasurementRepositoryPort } from '../domain/ports/indicator-measurement-repository.port';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import { resolveIndicatorComputedByRef } from './resolve-indicator-owner';

import type { IndicatorOwnerRef } from './resolve-indicator-owner';
import type { IndicatorMeasurementRecord } from '../domain/indicator-measurement.entity';

export interface ListIndicatorMeasurementsInput {
  readonly actorUserId: string;
  readonly metricKey: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface IndicatorMeasurementWithComputedByRef {
  readonly record: IndicatorMeasurementRecord;
  readonly computedBy: IndicatorOwnerRef;
}

export interface ListIndicatorMeasurementsResult {
  readonly items: readonly IndicatorMeasurementWithComputedByRef[];
  readonly total: number;
}

@Injectable()
export class ListIndicatorMeasurementsUseCase {
  constructor(
    private readonly measurementRepository: IndicatorMeasurementRepositoryPort,
    private readonly referenceData: IndicatorReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListIndicatorMeasurementsInput): Promise<ListIndicatorMeasurementsResult> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    if (scope.kind !== 'GLOBAL') {
      throw new ForbiddenDomainError(USER_MESSAGES.indicators.measurementRequiresGlobalScope);
    }

    const catalogEntry = findIndicatorMetricCatalogEntry(input.metricKey);
    if (!catalogEntry) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.metricKeyEntityLabel, input.metricKey);
    }

    const page = await this.measurementRepository.list({
      metricKey: catalogEntry.metricKey,
      page: input.page,
      pageSize: input.pageSize,
    });

    const items = await Promise.all(
      page.items.map(async (record) => ({
        record,
        computedBy: await resolveIndicatorComputedByRef(
          this.referenceData,
          record.computedByUserId,
        ),
      })),
    );

    return { items, total: page.total };
  }
}
