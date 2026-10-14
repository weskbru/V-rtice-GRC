import { Injectable } from '@nestjs/common';

import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import {
  getIndicatorMetricCatalogEntry,
  listAllIndicatorMetricKeys,
  type IndicatorMetricScopeApplicability,
  type IndicatorMetricShape,
} from '../domain/indicator-metric-catalog';
import { IndicatorDefinitionRepositoryPort } from '../domain/ports/indicator-definition-repository.port';

import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { IndicatorMetricKey } from '@prisma/client';

export interface IndicatorMetricCatalogSummary {
  readonly metricKey: IndicatorMetricKey;
  readonly defaultLabel: string;
  readonly sourcePermission: PermissionIdentifier;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly shape: IndicatorMetricShape;
  readonly hasDefinition: boolean;
}

@Injectable()
export class ListIndicatorMetricKeysUseCase {
  constructor(private readonly definitionRepository: IndicatorDefinitionRepositoryPort) {}

  async execute(): Promise<readonly IndicatorMetricCatalogSummary[]> {
    const configuredKeys = await this.definitionRepository.listConfiguredMetricKeys();

    return listAllIndicatorMetricKeys().map((metricKey) => {
      const entry = getIndicatorMetricCatalogEntry(metricKey);
      return {
        metricKey,
        defaultLabel: USER_MESSAGES.indicators.metricKeyLabels[metricKey],
        sourcePermission: entry.sourcePermission,
        scopeApplicability: entry.scopeApplicability,
        shape: entry.shape,
        hasDefinition: configuredKeys.has(metricKey),
      };
    });
  }
}
