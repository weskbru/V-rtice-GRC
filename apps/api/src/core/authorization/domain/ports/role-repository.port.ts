import type { PermissionRecord } from './permission-repository.port';

export interface RoleRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isSystem: boolean;
  readonly permissions: readonly PermissionRecord[];
  readonly assignedUserCount: number;
}

export interface ListRolesResult {
  readonly items: readonly RoleRecord[];
  readonly total: number;
}

export interface RoleSummaryCounts {
  readonly totalRoles: number;
  readonly systemRoles: number;
  readonly customRoles: number;
  readonly usersWithRoles: number;
}

export interface CreateRoleInput {
  readonly name: string;
  readonly description: string;
  readonly permissionIds: readonly string[];
}

export interface UpdateRoleFields {
  readonly name?: string;
  readonly description?: string;
}

export interface PreviousRoleFields {
  readonly name: string;
  readonly description: string;
  readonly isSystem: boolean;
}

export interface SetDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

export abstract class RoleRepositoryPort {
  abstract list(page: number, pageSize: number): Promise<ListRolesResult>;

  abstract findById(id: string): Promise<RoleRecord | undefined>;

  abstract findByIds(ids: readonly string[]): Promise<readonly { readonly id: string }[]>;

  abstract findByName(
    name: string,
    excludeRoleId?: string,
  ): Promise<{ readonly id: string } | undefined>;

  abstract create(input: CreateRoleInput): Promise<RoleRecord>;

  abstract updateFields(
    id: string,
    patch: UpdateRoleFields,
  ): Promise<PreviousRoleFields | undefined>;

  abstract replaceRolePermissions(
    roleId: string,
    permissionIds: readonly string[],
  ): Promise<SetDiff>;

  abstract countAssignedUsers(roleId: string): Promise<number>;

  abstract getSummaryCounts(): Promise<RoleSummaryCounts>;

  abstract delete(id: string): Promise<void>;

  abstract getUserRoleIds(userId: string): Promise<readonly string[]>;

  abstract replaceUserRoles(
    userId: string,
    roleIds: readonly string[],
    grantedByUserId: string,
    grantedAt: Date,
  ): Promise<SetDiff>;
}
