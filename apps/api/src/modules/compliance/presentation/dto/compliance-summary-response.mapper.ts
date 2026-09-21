/**
 * T056/004-compliance-management — maps `ComplianceSummaryResult`
 * (`application/compliance-summary/get-framework-version-compliance-summary.usecase.ts`)
 * to the wire shape `contracts/compliance.openapi.yaml`'s
 * `ComplianceSummary` schema describes. `compliancePercentage: undefined`
 * becomes `null` on the wire — "nothing to measure yet", never `0`/`100`
 * (FR-020).
 */
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
