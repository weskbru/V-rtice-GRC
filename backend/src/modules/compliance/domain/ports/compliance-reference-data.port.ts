export interface ComplianceActorRecord {
  readonly id: string;
  readonly fullName: string;
}

export abstract class ComplianceReferenceDataPort {
  abstract findUser(userId: string): Promise<ComplianceActorRecord | undefined>;
}
