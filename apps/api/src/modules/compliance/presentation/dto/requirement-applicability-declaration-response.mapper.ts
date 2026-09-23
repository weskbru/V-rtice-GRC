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
