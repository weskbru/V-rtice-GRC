/**
 * T015/005-audit-findings — the ADR-020 part 3 boundary port between
 * `modules/audit-engagements` and `modules/compliance` for `Requirement`
 * (the sibling of `framework-version-directory.port.ts` — see that file's
 * header for the shared reasoning this one does not repeat).
 *
 * `frameworkVersionStatus` is included alongside `frameworkVersionId` so
 * `LinkAuditScopeToRequirementUseCase` does not need a SECOND round trip
 * through `FrameworkVersionDirectoryPort` just to check publication —
 * mirroring `ControlDirectoryEntry`'s own choice to include `orgUnitId`
 * directly rather than force a second port call (research.md D-11).
 */
export interface RequirementDirectoryEntry {
  readonly id: string;
  readonly externalRef: string;
  readonly title: string;
  readonly frameworkVersionId: string;
  readonly frameworkVersionStatus: 'DRAFT' | 'PUBLISHED';
}

export abstract class RequirementDirectoryPort {
  abstract findById(id: string): Promise<RequirementDirectoryEntry | undefined>;
}
