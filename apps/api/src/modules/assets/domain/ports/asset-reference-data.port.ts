export interface AssetOrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export abstract class AssetReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<AssetOrgUnitLookup | undefined>;
  abstract findUser(
    id: string,
  ): Promise<{ readonly id: string; readonly fullName: string } | undefined>;
}
