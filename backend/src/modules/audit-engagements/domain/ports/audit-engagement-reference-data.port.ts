export interface AuditEngagementOrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export interface AuditEngagementActorLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
  readonly email: string;
}

export abstract class AuditEngagementReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<AuditEngagementOrgUnitLookup | undefined>;

  abstract findUser(id: string): Promise<AuditEngagementActorLookup | undefined>;
}
