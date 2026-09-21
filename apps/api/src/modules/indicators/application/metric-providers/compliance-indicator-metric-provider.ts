/**
 * 009-indicators-reports, T021 — `COMPLIANCE_PERCENTAGE`, the ONE
 * `OrganizationWideIndicatorMetricProvider` in the catalog (research.md
 * D-8). `computeValue()` takes NO `ScopeFilter` parameter — a compile-time
 * fact, proved at runtime by
 * `test/unit/indicator-calculation-service.spec.ts`'s own arity check
 * (`computeValue.length === 0`).
 *
 * Delegates to `ComplianceSummaryPort.getOrganizationWideCompliancePercentage`
 * (`shared/grc-ports/compliance-summary.port.ts`), which reuses
 * `calculateRequirementComplianceState` — the SAME single calculator
 * `GetFrameworkVersionComplianceSummaryUseCase` uses — aggregated across
 * every `PUBLISHED` `FrameworkVersion` (see that port's own header for why
 * this is an aggregate rather than a call to the per-version use case
 * directly: `GET /indicators/{metricKey}/current` carries no
 * `frameworkId`/`versionId` parameter to select one version).
 */
import { Injectable } from '@nestjs/common';

import { ComplianceSummaryPort } from '../../../../shared/grc-ports/compliance-summary.port';

import type {
  IndicatorMetricValue,
  OrganizationWideIndicatorMetricProvider,
} from '../../domain/indicator-metric-provider';

@Injectable()
export class CompliancePercentageProvider implements OrganizationWideIndicatorMetricProvider {
  readonly metricKey = 'COMPLIANCE_PERCENTAGE' as const;

  constructor(private readonly complianceSummary: ComplianceSummaryPort) {}

  async computeValue(): Promise<IndicatorMetricValue> {
    const percentage = await this.complianceSummary.getOrganizationWideCompliancePercentage();
    return { shape: 'SINGLE_VALUE', value: percentage };
  }
}
