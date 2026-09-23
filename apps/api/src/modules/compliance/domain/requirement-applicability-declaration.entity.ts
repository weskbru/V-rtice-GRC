export interface RequirementApplicabilityUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface RequirementApplicabilityDeclarationRecord {
  readonly id: string;
  readonly requirementId: string;
  readonly justification: string;
  readonly declaredBy: RequirementApplicabilityUserRef;
  readonly declaredAt: Date;
  readonly revokedBy: RequirementApplicabilityUserRef | undefined;
  readonly revokedAt: Date | undefined;
}

export function isDeclarationRevoked(
  declaration: RequirementApplicabilityDeclarationRecord,
): boolean {
  return declaration.revokedAt !== undefined;
}
