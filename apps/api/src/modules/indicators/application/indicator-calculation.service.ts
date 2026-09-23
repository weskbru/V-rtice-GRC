import { Injectable } from '@nestjs/common';

import {
  getIndicatorMetricCatalogEntry,
  type IndicatorMetricScopeApplicability,
  type IndicatorMetricShape,
} from '../domain/indicator-metric-catalog';
import { evaluateThresholdBreach } from '../domain/indicator-threshold';

import { ActionOverdueCountProvider } from './metric-providers/action-indicator-metric-provider';
import { AssetInactiveCountProvider } from './metric-providers/asset-indicator-metric-provider';
import { AuditEngagementOpenCountProvider } from './metric-providers/audit-engagement-indicator-metric-provider';
import { CompliancePercentageProvider } from './metric-providers/compliance-indicator-metric-provider';
import { ControlInactiveCountProvider } from './metric-providers/control-indicator-metric-provider';
import { FindingOpenCountBySeverityProvider } from './metric-providers/finding-indicator-metric-provider';
import { IncidentOpenCountBySeverityProvider } from './metric-providers/incident-indicator-metric-provider';
import { ProblemOpenCountBySeverityProvider } from './metric-providers/problem-indicator-metric-provider';
import { ProcessInactiveCountProvider } from './metric-providers/process-indicator-metric-provider';
import {
  RiskTotalByLevelProvider,
  RiskTreatmentOverdueCountProvider,
} from './metric-providers/risk-indicator-metric-provider';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { IndicatorDefinitionRecord } from '../domain/indicator-definition.entity';
import type {
  OrganizationWideIndicatorMetricProvider,
  ScopedIndicatorMetricProvider,
} from '../domain/indicator-metric-provider';
import type { IndicatorMetricKey } from '@prisma/client';

export interface IndicatorCalculationInput {
  readonly metricKey: IndicatorMetricKey;
  readonly scope: ScopeFilter;
  readonly definition: IndicatorDefinitionRecord | undefined;
}

export interface IndicatorCalculationResult {
  readonly metricKey: IndicatorMetricKey;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly shape: IndicatorMetricShape;
  readonly value: number | undefined;
  readonly valueByBucket: Readonly<Record<string, number>> | undefined;
  readonly breached: boolean;
}

@Injectable()
export class IndicatorCalculationService {
  private readonly scopedProviders: ReadonlyMap<IndicatorMetricKey, ScopedIndicatorMetricProvider>;
  private readonly organizationWideProviders: ReadonlyMap<
    IndicatorMetricKey,
    OrganizationWideIndicatorMetricProvider
  >;

  constructor(
    riskTotalByLevel: RiskTotalByLevelProvider,
    riskTreatmentOverdueCount: RiskTreatmentOverdueCountProvider,
    controlInactiveCount: ControlInactiveCountProvider,
    auditEngagementOpenCount: AuditEngagementOpenCountProvider,
    findingOpenCountBySeverity: FindingOpenCountBySeverityProvider,
    assetInactiveCount: AssetInactiveCountProvider,
    processInactiveCount: ProcessInactiveCountProvider,
    actionOverdueCount: ActionOverdueCountProvider,
    incidentOpenCountBySeverity: IncidentOpenCountBySeverityProvider,
    problemOpenCountBySeverity: ProblemOpenCountBySeverityProvider,
    compliancePercentage: CompliancePercentageProvider,
  ) {
    const scopedProviders: readonly ScopedIndicatorMetricProvider[] = [
      riskTotalByLevel,
      riskTreatmentOverdueCount,
      controlInactiveCount,
      auditEngagementOpenCount,
      findingOpenCountBySeverity,
      assetInactiveCount,
      processInactiveCount,
      actionOverdueCount,
      incidentOpenCountBySeverity,
      problemOpenCountBySeverity,
    ];
    this.scopedProviders = new Map(
      scopedProviders.map((provider) => [provider.metricKey, provider]),
    );
    this.organizationWideProviders = new Map([
      [compliancePercentage.metricKey, compliancePercentage],
    ]);
  }

  async calculate(input: IndicatorCalculationInput): Promise<IndicatorCalculationResult> {
    const catalogEntry = getIndicatorMetricCatalogEntry(input.metricKey);

    const metricValue =
      catalogEntry.scopeApplicability === 'ORGANIZATION_WIDE'
        ? await this.computeOrganizationWide(input.metricKey)
        : await this.computeScoped(input.metricKey, input.scope);

    const value = metricValue.shape === 'SINGLE_VALUE' ? metricValue.value : undefined;
    const valueByBucket = metricValue.shape === 'BY_BUCKET' ? metricValue.valueByBucket : undefined;

    const breached =
      value !== undefined
        ? evaluateThresholdBreach(
            input.definition?.thresholdComparator ?? null,
            value,
            input.definition?.thresholdValue ?? null,
          )
        : false;

    return {
      metricKey: input.metricKey,
      scopeApplicability: catalogEntry.scopeApplicability,
      shape: catalogEntry.shape,
      value,
      valueByBucket,
      breached,
    };
  }

  private async computeScoped(metricKey: IndicatorMetricKey, scope: ScopeFilter) {
    const provider = this.scopedProviders.get(metricKey);
    if (!provider) {
      throw new Error(
        `IndicatorCalculationService: no scoped provider registered for ${metricKey}.`,
      );
    }
    return provider.computeValue(scope);
  }

  private async computeOrganizationWide(metricKey: IndicatorMetricKey) {
    const provider = this.organizationWideProviders.get(metricKey);
    if (!provider) {
      throw new Error(
        `IndicatorCalculationService: no organization-wide provider registered for ${metricKey}.`,
      );
    }
    return provider.computeValue();
  }
}
