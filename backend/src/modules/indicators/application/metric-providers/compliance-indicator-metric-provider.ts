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
