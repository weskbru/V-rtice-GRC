export interface ControlDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly orgUnitId: string | null;
  readonly isActive: boolean;
}

export abstract class ControlDirectoryPort {
  abstract findById(id: string): Promise<ControlDirectoryEntry | undefined>;

  abstract findManyById(ids: readonly string[]): Promise<readonly ControlDirectoryEntry[]>;
}
