/**
 * T056/004-compliance-management — maps
 * `RequirementApplicabilityDeclarationRecord` to the wire shape
 * `contracts/compliance.openapi.yaml`'s
 * `RequirementApplicabilityDeclaration` schema describes. Unlike the
 * embedded projection on `Requirement.applicability`
 * (`requirement-response.mapper.ts`, always the active declaration, so
 * `revokedAt`/`revokedBy` are always null there), this mapper serves the
 * full listing/creation responses, where a declaration MAY already be
 * revoked (research.md D-7's own "retorna toda declaração, vigente e
 * revogada").
 */
import type {
  RequirementApplicabilityDeclarationRecord,
  RequirementApplicabilityUserRef,
} from '../../domain/requirement-applicability-declaration.entity';

export interface RequirementApplicabilityDeclarationResponse {
  readonly id: string;
  readonly justification: string;
  readonly declaredBy: RequirementApplicabilityUserRef;
  readonly declaredAt: string;
  readonly revokedBy: RequirementApplicabilityUserRef | null;
  readonly revokedAt: string | null;
}

export function toRequirementApplicabilityDeclarationResponse(
  record: RequirementApplicabilityDeclarationRecord,
): RequirementApplicabilityDeclarationResponse {
  return {
    id: record.id,
    justification: record.justification,
    declaredBy: record.declaredBy,
    declaredAt: record.declaredAt.toISOString(),
    revokedBy: record.revokedBy ?? null,
    revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
  };
}
