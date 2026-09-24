export interface ReportUserLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
}

export abstract class ReportReferenceDataPort {
  abstract findUser(id: string): Promise<ReportUserLookup | undefined>;
}
