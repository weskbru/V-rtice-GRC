export interface ControlOrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export interface ControlOwnerLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
  readonly email: string;
  readonly primaryOrgUnitId: string | undefined;
}

export abstract class ControlReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<ControlOrgUnitLookup | undefined>;
  abstract findUser(id: string): Promise<ControlOwnerLookup | undefined>;
}
