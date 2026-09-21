/**
 * T180 — maps `AdminUserRecord`/`AdminUserDetail` to
 * `contracts/admin.openapi.yaml`'s `User`/`UserDetail` response schemas.
 * Carries no credential material (FR-005) — neither domain type has any to
 * begin with.
 */
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

/**
 * F-73 — the response of `PUT /admin/users/{userId}/roles`, and the ONLY
 * `/admin/users**` representation reachable without `user:administer`.
 *
 * That operation is gated by `role:administer` on purpose (see
 * `AdminUsersController`'s header, and the contract's `Roles` tag) — that
 * decision stands. What does NOT follow from it is handing the caller the
 * administrative user record: `role:administer` does not imply
 * `user:administer` (015 FR-019), and `UserDetailResponse` carries exactly
 * the class of data FR-018/FR-020 exist to keep away from a caller who
 * lacks it — full name, e-mail, job title, status, organizational unit and
 * scope grants.
 *
 * So this is what the operation confirms and nothing else: WHICH subject
 * was changed (an id the caller already had — it is the path parameter) and
 * WHAT role set it now holds (role identity, which `role:administer`
 * already grants in full through `GET /admin/roles`). Anyone who needs the
 * user record itself has `GET /admin/users/{userId}`, correctly gated by
 * `user:administer`.
 *
 * Built by listing its two fields explicitly rather than by deleting keys
 * off `toUserResponse` — a field added to `UserResponse` later must not be
 * able to leak in here by inheritance.
 */
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
