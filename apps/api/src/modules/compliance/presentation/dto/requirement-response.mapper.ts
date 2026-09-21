/**
 * T030/004-compliance-management — maps `RequirementRecord`
 * (`domain/ports/requirement-repository.port.ts`) to the wire shape
 * `contracts/compliance.openapi.yaml`'s `Requirement` schema describes.
 * `applicability`/`complianceState` are always the freshly-derived values
 * `RequirementComplianceReaderService` computed — never a stored column
 * (FR-017, research.md D-8).
 */
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
    // Only the CURRENTLY ACTIVE declaration is ever embedded here
    // (`RequirementRepositoryPort.findActiveApplicability`'s own
    // contract: `revokedAt IS NULL`) — so `revokedBy`/`revokedAt` are
    // always null on this projection, matching the contract's own
    // "seu próprio revokedAt é sempre null quando embutido aqui".
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
