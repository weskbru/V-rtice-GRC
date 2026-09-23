export interface AssetDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly orgUnitId: string | null;
  readonly isActive: boolean;
}

export abstract class AssetDirectoryPort {
  abstract findById(id: string): Promise<AssetDirectoryEntry | undefined>;

  abstract findManyById(ids: readonly string[]): Promise<readonly AssetDirectoryEntry[]>;
}
