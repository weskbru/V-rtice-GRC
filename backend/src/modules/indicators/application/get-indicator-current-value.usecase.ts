import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ForbiddenDomainError, NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { findIndicatorMetricCatalogEntry } from '../domain/indicator-metric-catalog';
import { IndicatorDefinitionRepositoryPort } from '../domain/ports/indicator-definition-repository.port';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import { IndicatorCalculationService } from './indicator-calculation.service';
import { resolveIndicatorOwnerRef, type IndicatorOwnerRef } from './resolve-indicator-owner';

import type { IndicatorDefinitionRecord } from '../domain/indicator-definition.entity';
import type {
  IndicatorMetricScopeApplicability,
  IndicatorMetricShape,
} from '../domain/indicator-metric-catalog';
import type { IndicatorMetricKey } from '@prisma/client';

export interface GetIndicatorCurrentValueInput {
  readonly actorUserId: string;
  readonly metricKey: string;
}

export interface IndicatorDefinitionWithOwnerRef {
  readonly record: IndicatorDefinitionRecord;
  readonly owner: IndicatorOwnerRef;
}

export interface GetIndicatorCurrentValueResult {
  readonly metricKey: IndicatorMetricKey;
  readonly shape: IndicatorMetricShape;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly value: number | undefined;
  readonly valueByBucket: Readonly<Record<string, number>> | undefined;
  readonly definition: IndicatorDefinitionWithOwnerRef | undefined;
  readonly computedAt: Date;
}

@Injectable()
export class GetIndicatorCurrentValueUseCase {
  constructor(
    private readonly definitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly referenceData: IndicatorReferenceDataPort,
    private readonly calculationService: IndicatorCalculationService,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: GetIndicatorCurrentValueInput): Promise<GetIndicatorCurrentValueResult> {
    const catalogEntry = findIndicatorMetricCatalogEntry(input.metricKey);
    if (!catalogEntry) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.metricKeyEntityLabel, input.metricKey);
    }

    const canViewSource = await this.permissionResolver.hasPermission(
      input.actorUserId,
      catalogEntry.sourcePermission,
    );
    if (!canViewSource) {
      throw new ForbiddenDomainError(
        USER_MESSAGES.indicators.sourcePermissionRequired(catalogEntry.sourcePermission),
      );
    }

    const [scope, definitionRecord] = await Promise.all([
      this.scopeResolver.resolveScope(input.actorUserId),
      this.definitionRepository.findByMetricKey(catalogEntry.metricKey),
    ]);

    const result = await this.calculationService.calculate({
      metricKey: catalogEntry.metricKey,
      scope,
      definition: definitionRecord,
    });

    const definition = definitionRecord
      ? {
          record: definitionRecord,
          owner: await resolveIndicatorOwnerRef(this.referenceData, definitionRecord.ownerUserId),
        }
      : undefined;

    return {
      metricKey: result.metricKey,
      shape: result.shape,
      scopeApplicability: result.scopeApplicability,
      value: result.value,
      valueByBucket: result.valueByBucket,
      definition,
      computedAt: new Date(),
    };
  }
}
