export interface ProcessDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly orgUnitId: string | null;
  readonly isActive: boolean;
}

export abstract class ProcessDirectoryPort {
  abstract findById(id: string): Promise<ProcessDirectoryEntry | undefined>;

  abstract findManyById(ids: readonly string[]): Promise<readonly ProcessDirectoryEntry[]>;
}
