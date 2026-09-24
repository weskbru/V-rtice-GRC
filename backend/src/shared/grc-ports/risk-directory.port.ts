export interface RiskDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly orgUnitId: string;
  readonly isActive: boolean;
}

export abstract class RiskDirectoryPort {
  abstract findById(id: string): Promise<RiskDirectoryEntry | undefined>;
}
