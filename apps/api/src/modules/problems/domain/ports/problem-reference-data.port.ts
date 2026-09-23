export interface ProblemOrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export interface ProblemOwnerLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
  readonly primaryOrgUnitId: string | undefined;
}

export abstract class ProblemReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<ProblemOrgUnitLookup | undefined>;
  abstract findUser(id: string): Promise<ProblemOwnerLookup | undefined>;
}
