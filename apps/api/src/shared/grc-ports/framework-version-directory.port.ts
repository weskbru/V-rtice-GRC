export interface FrameworkVersionDirectoryEntry {
  readonly id: string;
  readonly label: string;
  readonly status: 'DRAFT' | 'PUBLISHED';
  readonly frameworkId: string;
}

export abstract class FrameworkVersionDirectoryPort {
  abstract findById(id: string): Promise<FrameworkVersionDirectoryEntry | undefined>;
}
