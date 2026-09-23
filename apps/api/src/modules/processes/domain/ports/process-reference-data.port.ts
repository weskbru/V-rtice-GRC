export interface ProcessOrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export abstract class ProcessReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<ProcessOrgUnitLookup | undefined>;
  abstract findUser(
    id: string,
  ): Promise<{ readonly id: string; readonly fullName: string } | undefined>;
}
