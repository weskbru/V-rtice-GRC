export type AdminUserStatus = 'ACTIVE' | 'INACTIVE';

export type AuthenticationMethod = 'LOCAL' | 'LDAP' | 'ACTIVE_DIRECTORY' | 'OIDC' | 'SAML';

export type PermissionAction =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'APPROVE'
  | 'ADMINISTER'
  | 'ASSESS'
  | 'TREAT'
  | 'TRANSITION';

export type OrgScopeType = 'UNIT' | 'GLOBAL';

export interface Page<T> {
  readonly data: readonly T[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface AdminOrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AdminRoleRef {
  readonly id: string;
  readonly name: string;
}

export interface AdminUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnit?: AdminOrgUnitRef | null;
}

export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly status: AdminUserStatus;
  readonly primaryOrgUnit: AdminOrgUnitRef | null;
  readonly roles: readonly AdminRoleRef[];
  readonly authenticationMethods: readonly AuthenticationMethod[];
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export interface AdminUserDetail extends AdminUser {
  readonly scopeGrants: readonly OrgScopeGrant[];
}

export interface CreateUserRequest {
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnitId?: string | null;
  readonly initialPassword: string;
  readonly roleIds?: readonly string[];
  readonly scopeGrants?: readonly GrantOrgScopeRequest[];
}

export interface UpdateUserRequest {
  readonly email?: string;
  readonly fullName?: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnitId?: string | null;
}

export interface SetUserStatusRequest {
  readonly status: AdminUserStatus;
  readonly reason?: string;
}

export interface ResetUserPasswordRequest {
  readonly newPassword: string;
}

export interface ReplaceUserRolesRequest {
  readonly roleIds: readonly string[];
}

export interface UserRoleAssignment {
  readonly userId: string;
  readonly roles: readonly AdminRoleRef[];
}

export interface Permission {
  readonly identifier: string;
  readonly resource: string;
  readonly action: PermissionAction;
  readonly description: string;
}

export interface Role {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isSystem: boolean;
  readonly permissions: readonly Permission[];
  readonly assignedUserCount: number;
}

export type SeededRoleName =
  | 'Platform Administrator'
  | 'Risk Manager'
  | 'Risk Analyst'
  | 'Risk Approver'
  | 'Control Owner'
  | 'Control Approver'
  | 'Compliance Manager'
  | 'Auditor'
  | 'Read Only'
  | 'Audit Lead'
  | 'Incident Manager'
  | 'Problem Manager';

export interface RolesSummary {
  readonly totalRoles: number;
  readonly systemRoles: number;
  readonly customRoles: number;
  readonly usersWithRoles: number;
}

export interface WriteRoleRequest {
  readonly name: string;
  readonly description: string;
  readonly permissionIdentifiers: readonly string[];
}

export interface UpdateRoleRequest {
  readonly name?: string;
  readonly description?: string;
  readonly permissionIdentifiers?: readonly string[];
}

export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: AdminUserStatus;
  readonly childCount: number;
}

export interface CreateOrgUnitRequest {
  readonly code: string;
  readonly name: string;
  readonly parentId?: string | null;
}

export interface UpdateOrgUnitRequest {
  readonly code?: string;
  readonly name?: string;
  readonly parentId?: string | null;
}

export interface SetOrgUnitStatusRequest {
  readonly status: AdminUserStatus;
}

export interface OrgScopeGrant {
  readonly id: string;
  readonly scopeType: OrgScopeType;
  readonly orgUnit: AdminOrgUnitRef | null;
  readonly grantedBy?: AdminUserRef;
  readonly grantedAt: string;
}

export interface GrantOrgScopeRequest {
  readonly scopeType: OrgScopeType;
  readonly orgUnitId?: string | null;
}

export interface DirectoryUser {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnit?: AdminOrgUnitRef | null;
}

export type AdminUserSortField = 'fullName' | 'email' | 'status' | 'lastLoginAt';

export type RoleTypeFilter = 'all' | 'system' | 'custom';

export type RoleSortOption = 'name:asc' | 'name:desc' | 'permissions:desc' | 'users:desc';
