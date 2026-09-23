export interface OrgScopeGrantRecord {
  readonly scopeType: 'GLOBAL' | 'UNIT';
  readonly orgUnitId?: string;
}

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface DetailedOrgScopeGrantRecord {
  readonly id: string;
  readonly scopeType: 'GLOBAL' | 'UNIT';
  readonly orgUnit: OrgUnitRefRecord | undefined;
  readonly grantedBy: UserRefRecord;
  readonly grantedAt: Date;
}

export interface CreateOrgScopeGrantInput {
  readonly userId: string;
  readonly scopeType: 'GLOBAL' | 'UNIT';
  readonly orgUnitId: string | undefined;
  readonly grantedByUserId: string;
}

export abstract class OrgScopeRepositoryPort {
  abstract getUserGrants(userId: string): Promise<readonly OrgScopeGrantRecord[]>;

  abstract expandToDescendants(orgUnitIds: readonly string[]): Promise<ReadonlySet<string>>;

  abstract getOrgTreeVersion(): Promise<number>;

  abstract getGrantsVersion(): Promise<number>;

  abstract bumpOrgTreeVersion(): Promise<number>;

  abstract bumpGrantsVersion(): Promise<number>;

  abstract userExists(userId: string): Promise<boolean>;

  abstract listDetailedGrants(userId: string): Promise<readonly DetailedOrgScopeGrantRecord[]>;

  abstract findDuplicateGrant(
    input: Pick<CreateOrgScopeGrantInput, 'userId' | 'scopeType' | 'orgUnitId'>,
  ): Promise<{ readonly id: string } | undefined>;

  abstract createGrant(input: CreateOrgScopeGrantInput): Promise<DetailedOrgScopeGrantRecord>;

  abstract findGrantById(
    userId: string,
    grantId: string,
  ): Promise<
    | {
        readonly id: string;
        readonly scopeType: 'GLOBAL' | 'UNIT';
        readonly orgUnitId: string | undefined;
      }
    | undefined
  >;

  abstract deleteGrant(grantId: string): Promise<void>;
}
