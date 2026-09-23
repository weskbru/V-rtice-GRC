export interface UserLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
}

export abstract class ActionReferenceDataPort {
  abstract findUser(id: string): Promise<UserLookup | undefined>;
}
