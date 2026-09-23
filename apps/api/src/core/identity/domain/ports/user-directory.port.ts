import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { AuthenticationMethod, UserStatus } from '@prisma/client';

export interface LocalAuthenticationSubject {
  readonly userId: string;
  readonly userStatus: UserStatus;
  readonly userFullName: string;
  readonly userEmail: string;
  readonly credentialId: string;
  readonly passwordHash: string;
  readonly failedAttempts: number;
  readonly lockedUntil: Date | undefined;
  readonly mustChangePassword: boolean;
}

export interface UserIdentitySummary {
  readonly id: string;
  readonly status: UserStatus;
  readonly fullName: string;
  readonly primaryOrgUnitId: string | undefined;
}

export interface OrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RoleRef {
  readonly id: string;
  readonly name: string;
}

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | undefined;
  readonly status: UserStatus;
  readonly primaryOrgUnit: OrgUnitRef | undefined;
  readonly roles: readonly RoleRef[];
  readonly lastLoginAt: Date | undefined;
}

export interface LocalCredentialSummary {
  readonly credentialId: string;
  readonly passwordHash: string;
}

export interface DirectoryUserRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle: string | undefined;
  readonly primaryOrgUnit: OrgUnitRef | undefined;
}

export interface ListDirectoryUsersInput {
  readonly scope: ScopeFilter;
  readonly assignment?: { readonly unitIds: readonly string[] };
  readonly page: number;
  readonly pageSize: number;
  readonly q: string | undefined;
}

export interface ListDirectoryUsersResult {
  readonly items: readonly DirectoryUserRecord[];
  readonly total: number;
}

export interface AdminUserRecord {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | undefined;
  readonly status: UserStatus;
  readonly primaryOrgUnit: OrgUnitRef | undefined;
  readonly roles: readonly RoleRef[];
  readonly authenticationMethods: readonly AuthenticationMethod[];
  readonly lastLoginAt: Date | undefined;
  readonly createdAt: Date;
}

export type AdminUserSortField = 'fullName' | 'email' | 'status' | 'lastLoginAt';
export type AdminSortDirection = 'asc' | 'desc';

export interface ListAdminUsersInput {
  readonly page: number;
  readonly pageSize: number;
  readonly q: string | undefined;
  readonly status: UserStatus | undefined;
  readonly orgUnitId: string | undefined;
  readonly roleId: string | undefined;
  readonly sortField: AdminUserSortField;
  readonly sortDirection: AdminSortDirection;
}

export interface ListAdminUsersResult {
  readonly items: readonly AdminUserRecord[];
  readonly total: number;
}

export interface CreateUserRow {
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | undefined;
  readonly primaryOrgUnitId: string | undefined;
  readonly passwordHash: string;
  readonly mustChangePassword: boolean;
}

export interface UpdateProfileFields {
  readonly email?: string;
  readonly fullName?: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnitId?: string | null;
}

export interface PreviousProfileFields {
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | undefined;
  readonly primaryOrgUnitId: string | undefined;
}

export abstract class UserDirectoryPort {
  abstract findAuthenticationSubject(
    email: string,
  ): Promise<LocalAuthenticationSubject | undefined>;

  abstract findIdentitySummary(userId: string): Promise<UserIdentitySummary | undefined>;

  abstract findProfileById(userId: string): Promise<UserProfile | undefined>;

  abstract findLocalCredentialByUserId(userId: string): Promise<LocalCredentialSummary | undefined>;

  abstract touchLastLoginAt(userId: string, at: Date): Promise<void>;

  abstract recordFailedAttempt(
    credentialId: string,
    input: { failedAttempts: number; lockedUntil: Date | undefined },
  ): Promise<void>;

  abstract recordSuccessfulAuthentication(credentialId: string): Promise<void>;

  abstract updatePassword(
    credentialId: string,
    input: { passwordHash: string; passwordChangedAt: Date; mustChangePassword: boolean },
  ): Promise<void>;

  abstract setStatus(userId: string, status: UserStatus): Promise<UserStatus | undefined>;

  abstract listDirectory(input: ListDirectoryUsersInput): Promise<ListDirectoryUsersResult>;

  abstract findByEmail(email: string): Promise<{ id: string } | undefined>;

  abstract createUserWithCredential(input: CreateUserRow): Promise<AdminUserRecord>;

  abstract updateProfile(
    userId: string,
    patch: UpdateProfileFields,
  ): Promise<PreviousProfileFields | undefined>;

  abstract listAdmin(input: ListAdminUsersInput): Promise<ListAdminUsersResult>;

  abstract findAdminRecordById(userId: string): Promise<AdminUserRecord | undefined>;

  abstract findOrgUnitForValidation(
    orgUnitId: string,
  ): Promise<{ readonly id: string; readonly isActive: boolean } | undefined>;
}
