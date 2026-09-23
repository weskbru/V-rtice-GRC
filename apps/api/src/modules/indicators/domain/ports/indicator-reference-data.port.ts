export interface IndicatorUserLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
}

export abstract class IndicatorReferenceDataPort {
  abstract findUser(id: string): Promise<IndicatorUserLookup | undefined>;

  abstract findUserOrgUnitId(userId: string): Promise<string | undefined>;
}
