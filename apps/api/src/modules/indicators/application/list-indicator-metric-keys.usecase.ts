/**
 * 009-indicators-reports, Fase 8 (T068 prep) — `ListIndicatorMetricKeysUseCase`
 * (`listIndicatorMetricKeys`, `GET /indicators/metric-keys`). Requires only
 * `indicator:view` — unlike `GetIndicatorCurrentValueUseCase`, there is no
 * dynamic second permission here: this operation reads the CATALOG itself
 * (`INDICATOR_METRIC_CATALOG`, `domain/indicator-metric-catalog.ts`), never
 * a source domain's own data (`contracts/indicators.openapi.yaml`'s own
 * `listIndicatorMetricKeys` description: "Every key in the response exists
 * regardless of whether an `IndicatorDefinition` has been created for it").
 *
 * No `ScopeFilter` (research.md D-8) — `hasDefinition` reads
 * `IndicatorDefinitionRepositoryPort.listConfiguredMetricKeys()`, itself
 * unscoped for the same reason every other read on this table is.
 */
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
