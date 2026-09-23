import type { ComplianceSummaryResult } from '../../application/compliance-summary/get-framework-version-compliance-summary.usecase';

export interface ComplianceSummaryResponse {
  readonly frameworkVersion: ComplianceSummaryResult['frameworkVersion'];
  readonly totalRequirements: number;
  readonly applicableRequirementCount: number;
  readonly counts: ComplianceSummaryResult['counts'];
  readonly compliancePercentage: number | null;
  readonly computedAt: string;
}

export function toComplianceSummaryResponse(
  result: ComplianceSummaryResult,
): ComplianceSummaryResponse {
  return {
    frameworkVersion: result.frameworkVersion,
    totalRequirements: result.totalRequirements,
    applicableRequirementCount: result.applicableRequirementCount,
    counts: result.counts,
    compliancePercentage: result.compliancePercentage ?? null,
    computedAt: result.computedAt.toISOString(),
  };
}
