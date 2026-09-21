/**
 * T045/004-compliance-management, User Story 3 — port for
 * `RequirementApplicabilityDeclaration` (data-model.md §6). No
 * `ScopeFilter` — the requirement side of this table carries no
 * organizational scope (research.md D-2).
 */
import type { RequirementApplicabilityDeclarationRecord } from '../requirement-applicability-declaration.entity';

export interface ApplicabilityDeclarationListPage {
  readonly items: readonly RequirementApplicabilityDeclarationRecord[];
  readonly total: number;
}

export abstract class RequirementApplicabilityRepositoryPort {
  /** The currently active declaration (`revokedAt IS NULL`), or
   * `undefined` — applicable by default (FR-015 AS1). */
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

  /** Newest first (contract's own `listRequirementApplicabilityDeclarations`
   * description). */
  abstract list(
    requirementId: string,
    page: number,
    pageSize: number,
  ): Promise<ApplicabilityDeclarationListPage>;
}
