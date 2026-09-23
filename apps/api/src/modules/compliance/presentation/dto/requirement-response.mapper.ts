import type {
  RequirementApplicabilityRef,
  RequirementFrameworkVersionRef,
  RequirementRecord,
} from '../../domain/ports/requirement-repository.port';
import type { RequirementComplianceState } from '@prisma/client';

export interface RequirementApplicabilityResponse {
  readonly id: string;
  readonly justification: string;
  readonly declaredBy: RequirementApplicabilityRef['declaredBy'];
  readonly declaredAt: string;
  readonly revokedBy: null;
  readonly revokedAt: null;
}

export interface RequirementResponse {
  readonly id: string;
  readonly frameworkVersion: RequirementFrameworkVersionRef;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
  readonly applicability: RequirementApplicabilityResponse | null;
  readonly complianceState: RequirementComplianceState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toApplicabilityResponse(
  ref: RequirementApplicabilityRef | undefined,
): RequirementApplicabilityResponse | null {
  if (!ref) {
    return null;
  }
  return {
    id: ref.id,
    justification: ref.justification,
    declaredBy: ref.declaredBy,
    declaredAt: ref.declaredAt.toISOString(),
    revokedBy: null,
    revokedAt: null,
  };
}

export function toRequirementResponse(record: RequirementRecord): RequirementResponse {
  return {
    id: record.id,
    frameworkVersion: record.frameworkVersion,
    externalRef: record.externalRef,
    title: record.title,
    description: record.description,
    applicability: toApplicabilityResponse(record.applicability),
    complianceState: record.complianceState,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
