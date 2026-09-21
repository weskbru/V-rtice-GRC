/**
 * T045/004-compliance-management, User Story 3 (data-model.md §6,
 * research.md D-7) — domain shape for
 * `RequirementApplicabilityDeclaration`. A succession of events, never a
 * rewritten flag: `isDeclarationRevoked` is the one predicate every
 * consumer needs, mirroring `isLinkWithdrawn`
 * (`requirement-control-link.entity.ts`) for the identical
 * withdraw/revoke shape.
 */
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
