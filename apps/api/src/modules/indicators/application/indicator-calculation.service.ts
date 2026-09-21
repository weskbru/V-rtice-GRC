/**
 * 009-indicators-reports, T029 — `IndicatorCalculationService`. The
 * **single** point in this codebase that computes an `IndicatorMetricKey`'s
 * current value and evaluates whether it breaches its configured threshold
 * (CLAUDE.md §19.7). US1's future `GetIndicatorCurrentValueUseCase`,
 * US2's `CreateIndicatorMeasurementUseCase`, and US5's `RunReportUseCase`
 * (T030/T035/T052, all out of this task's own scope) are each required to
 * call THIS service — never a provider directly, and never a second
 * calculation of `breached` (FR-016).
 *
 * ## How "no provider is ever called from anywhere else" is structural,
 * not just documented
 *
 * Every `*IndicatorMetricProvider` class lives under
 * `application/metric-providers/` and is `@Injectable()`, but **none of
 * them is exported from `IndicatorsModule`** (see that module's own
 * `providers`/`exports` split) — Nest's DI container only resolves a
 * provider for a consumer that is itself part of the SAME module (or a
 * module the provider's own module explicitly exports it to). Only this
 * service's constructor requests them, and only this service is exported
 * for another module (a future controller/use-case module) to inject.
 * A future caller that wanted to reach `RiskTotalByLevelProvider` directly
 * would have to add it to `IndicatorsModule`'s own `exports` array — a
 * change visible in review, not a silent bypass.
 *
 * ## Dispatch, never a provider that branches on `metricKey` itself
 *
 * Each provider computes exactly one key (see
 * `domain/indicator-metric-provider.ts`'s own header for why). This
 * service is the ONLY place a key is mapped to its provider — two small
 * `Map`s, one per provider shape (`ScopedIndicatorMetricProvider`/
 * `OrganizationWideIndicatorMetricProvider`), built once in the
 * constructor from the catalog's own `scopeApplicability`
 * (`indicator-metric-catalog.ts`) so a key's shape and its dispatch target
 * can never disagree.
 *
 * ## Threshold evaluation (FR-016) happens HERE, in the same call
 *
 * `evaluateThresholdBreach` (T013, `domain/indicator-threshold.ts`) is
 * invoked immediately after the value is computed, in the same method,
 * never a second pass. `breached` is `false`, not merely "not evaluated",
 * whenever there is nothing meaningful to compare: no `IndicatorDefinition`
 * for the key (`definition` is `undefined`), a `BY_BUCKET` metric (a
 * threshold compares one number — data-model.md §4's `IndicatorThresholdComparator`
 * has no bucket-aware variant, and no FR/scenario in spec.md exercises
 * threshold+`BY_BUCKET`), or a `SINGLE_VALUE` metric whose source has no
 * data yet (`value: undefined` — spec.md's own "nunca 0 nem 100" edge
 * case: an unmeasurable value cannot "breach" anything either).
 */
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
  /** The caller's resolved scope — ALWAYS required, even for the one key
   * (`COMPLIANCE_PERCENTAGE`) this service never forwards it to. Mirrors
   * FR-006's "resolve escopo uma vez": the future use case resolves scope
   * exactly once per request, regardless of which key is asked for; this
   * service is what decides whether that scope is applicable at all. */
  readonly scope: ScopeFilter;
  /** `undefined` when no `IndicatorDefinition` exists yet for this key
   * (data-model.md §1: a definition is optional configuration) — `US1`
   * (`GET .../current`) works either way (FR-001). */
  readonly definition: IndicatorDefinitionRecord | undefined;
}

export interface IndicatorCalculationResult {
  readonly metricKey: IndicatorMetricKey;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly shape: IndicatorMetricShape;
  /** Populated only when `shape === 'SINGLE_VALUE'` (Invariant M1) —
   * `undefined` there too when the source has no data yet
   * (`COMPLIANCE_PERCENTAGE`'s own edge case). */
  readonly value: number | undefined;
  /** Populated only when `shape === 'BY_BUCKET'` (Invariant M1). */
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

    // FR-016 — evaluated here, in the same call, never a second pass. A
    // `BY_BUCKET` metric or an unmeasurable `SINGLE_VALUE` (`value ===
    // undefined`) never breaches: there is no single number to compare.
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
      // Unreachable for any key in the closed `IndicatorMetricKey` enum —
      // `test/unit/indicator-calculation-service.spec.ts` proves every
      // key has a registered provider. Thrown, not silently defaulted, so
      // a future enum addition without a matching provider fails loudly.
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
