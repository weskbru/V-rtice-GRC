import type { RequirementComplianceState } from '@prisma/client';

export interface ComplianceStateBreakdown {
  readonly requirementCount: number;
  readonly byState: Readonly<Record<RequirementComplianceState, number>>;
}

export abstract class ComplianceSummaryPort {
  abstract getOrganizationWideCompliancePercentage(): Promise<number | undefined>;

  abstract getStateBreakdown(): Promise<ComplianceStateBreakdown>;
}
