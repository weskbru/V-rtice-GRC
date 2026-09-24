import { toOrgScopeGrantResponse } from '../../../organizations/presentation/dto/org-scope-grant-response.mapper';

import type { OrgScopeGrantResponse } from '../../../organizations/presentation/dto/org-scope-grant-response.mapper';
import type { AdminUserDetail } from '../../application/get-user.usecase';
import type { AdminUserRecord } from '../../domain/ports/user-directory.port';

export interface OrgUnitRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RoleRefResponse {
  readonly id: string;
  readonly name: string;
}

export interface UserResponse {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | null;
  readonly status: string;
  readonly primaryOrgUnit: OrgUnitRefResponse | null;
  readonly roles: readonly RoleRefResponse[];
  readonly authenticationMethods: readonly string[];
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export interface UserDetailResponse extends UserResponse {
  readonly scopeGrants: readonly OrgScopeGrantResponse[];
}

export function toUserResponse(user: AdminUserRecord): UserResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    jobTitle: user.jobTitle ?? null,
    status: user.status,
    primaryOrgUnit: user.primaryOrgUnit ?? null,
    roles: user.roles,
    authenticationMethods: user.authenticationMethods,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toUserDetailResponse(user: AdminUserDetail): UserDetailResponse {
  return {
    ...toUserResponse(user),
    scopeGrants: user.scopeGrants.map(toOrgScopeGrantResponse),
  };
}

export interface UserRoleAssignmentResponse {
  readonly userId: string;
  readonly roles: readonly RoleRefResponse[];
}

export function toUserRoleAssignmentResponse(user: AdminUserRecord): UserRoleAssignmentResponse {
  return {
    userId: user.id,
    roles: user.roles.map((role) => ({ id: role.id, name: role.name })),
  };
}
