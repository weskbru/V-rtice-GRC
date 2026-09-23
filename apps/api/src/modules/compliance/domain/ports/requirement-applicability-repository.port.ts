import type { RequirementApplicabilityDeclarationRecord } from '../requirement-applicability-declaration.entity';

export interface ApplicabilityDeclarationListPage {
  readonly items: readonly RequirementApplicabilityDeclarationRecord[];
  readonly total: number;
}

export abstract class RequirementApplicabilityRepositoryPort {
  abstract findActive(
    requirementId: string,
  ): Promise<RequirementApplicabilityDeclarationRecord | undefined>;

  abstract create(
    requirementId: string,
    justification: string,
    declaredByUserId: string,
    declaredAt: Date,
  ): Promise<RequirementApplicabilityDeclarationRecord>;

  abstract findById(
    requirementId: string,
    declarationId: string,
  ): Promise<RequirementApplicabilityDeclarationRecord | undefined>;

  abstract revoke(
    declarationId: string,
    revokedByUserId: string,
    revokedAt: Date,
  ): Promise<RequirementApplicabilityDeclarationRecord>;

  abstract list(
    requirementId: string,
    page: number,
    pageSize: number,
  ): Promise<ApplicabilityDeclarationListPage>;
}
