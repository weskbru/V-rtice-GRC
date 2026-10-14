export interface OrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export interface UserLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
  readonly primaryOrgUnitId: string | undefined;
}

export interface ReferenceDataLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export interface ReferenceDataItemRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly sortOrder: number;
  readonly isActive: boolean;
}

export abstract class RiskReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<OrgUnitLookup | undefined>;
  abstract findUser(id: string): Promise<UserLookup | undefined>;
  abstract findCategory(id: string): Promise<ReferenceDataLookup | undefined>;
  abstract findType(id: string): Promise<ReferenceDataLookup | undefined>;
  abstract findOrigin(id: string): Promise<ReferenceDataLookup | undefined>;

  abstract listCategories(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]>;
  abstract listTypes(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]>;
  abstract listOrigins(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]>;
}
