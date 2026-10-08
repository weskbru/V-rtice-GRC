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
