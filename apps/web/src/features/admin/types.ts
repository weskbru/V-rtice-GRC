/**
 * PharosGRC frontend — Administration (US8, T181–T183) types.
 *
 * Hand-written against `specs/001-grc-platform-foundation/contracts/admin.openapi.yaml`,
 * for the same reason `apps/web/src/features/risks/types.ts` is hand-written
 * (`packages/api-types` is not yet generated from a populated
 * `apps/api/openapi.json` — T205, see `docs/deferred-findings.md` F-3).
 * Every shape below mirrors a named schema in that contract. This module is
 * deliberately independent of `features/risks/types.ts` — Administration and
 * Risk Management are separate frontend feature areas (CLAUDE.md §2, low
 * coupling) even where a schema (e.g. `UserRef`, `OrgUnitRef`, `Page`) is
 * structurally identical between the two contracts.
 */

/** Mirrors `enum UserStatus` (data-model.md, FR-011). */
export type AdminUserStatus = 'ACTIVE' | 'INACTIVE';

/** Mirrors `User.authenticationMethods` items (FR-002). Only `LOCAL` is exercised in this release. */
export type AuthenticationMethod = 'LOCAL' | 'LDAP' | 'ACTIVE_DIRECTORY' | 'OIDC' | 'SAML';

/** Mirrors `enum PermissionAction`. */
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

/** Mirrors `enum OrgScopeType` (FR-025a, FR-025b). */
export type OrgScopeType = 'UNIT' | 'GLOBAL';

/** Offset-pagination envelope (ADR-009). */
export interface Page<T> {
  readonly data: readonly T[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

/** Mirrors `OrgUnitRef` (admin.openapi.yaml). */
export interface AdminOrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `RoleRef`. */
export interface AdminRoleRef {
  readonly id: string;
  readonly name: string;
}

/** Mirrors `UserRef` as used by `OrgScopeGrant.grantedBy`. */
export interface AdminUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnit?: AdminOrgUnitRef | null;
}

/** Mirrors `User` (administrative representation — never carries credential material, FR-005). */
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

/** Mirrors `UserDetail` — `User` plus its organizational scope grants. */
export interface AdminUserDetail extends AdminUser {
  readonly scopeGrants: readonly OrgScopeGrant[];
}

/** Mirrors `CreateUserRequest`. */
export interface CreateUserRequest {
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnitId?: string | null;
  readonly initialPassword: string;
  readonly roleIds?: readonly string[];
  readonly scopeGrants?: readonly GrantOrgScopeRequest[];
}

/** Mirrors `UpdateUserRequest`. */
export interface UpdateUserRequest {
  readonly email?: string;
  readonly fullName?: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnitId?: string | null;
}

/** Mirrors `SetUserStatusRequest`. */
export interface SetUserStatusRequest {
  readonly status: AdminUserStatus;
  readonly reason?: string;
}

/** Mirrors `ResetUserPasswordRequest`. */
export interface ResetUserPasswordRequest {
  readonly newPassword: string;
}

/** Mirrors `ReplaceUserRolesRequest`. */
export interface ReplaceUserRolesRequest {
  readonly roleIds: readonly string[];
}

/**
 * Mirrors `UserRoleAssignment` — what `PUT /admin/users/{userId}/roles`
 * answers (F-73). Deliberately NOT `AdminUserDetail`: that operation is the
 * only `/admin/users**` one reachable with `role:administer` alone, and
 * `role:administer` does not imply `user:administer` (015 FR-019), so its
 * response carries no name, e-mail, job title, status, organizational unit
 * or scope grant. Typing it here is also the frontend's half of the guard:
 * a future caller cannot read a personal field off this result, because the
 * type does not have one.
 */
export interface UserRoleAssignment {
  readonly userId: string;
  readonly roles: readonly AdminRoleRef[];
}

/** Mirrors `Permission` — a seeded, read-only `resource:action` entry. */
export interface Permission {
  readonly identifier: string;
  readonly resource: string;
  readonly action: PermissionAction;
  readonly description: string;
}

/** Mirrors `Role`. */
export interface Role {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isSystem: boolean;
  readonly permissions: readonly Permission[];
  readonly assignedUserCount: number;
}

/**
 * The `name` of each role the platform seeds
 * (`apps/api/prisma/seed/platform.seed.ts`, `SYSTEM_ROLE_DEFINITIONS`).
 *
 * These twelve strings are **database identifiers**, not copy: `Role.name` is
 * `@unique` and is the key `upsertSystemRoles` upserts on, so renaming one
 * would be a data migration with an RBAC blast radius. They stay in English
 * exactly as CLAUDE.md §11.1 requires of a seeded role name, and nothing in
 * this union is ever sent to the server or rendered raw as a heading — it
 * exists only so the single pt-BR display map (`common.roleDisplayNames`,
 * resolved by `@/lib/role-display-name`) can be proved EXHAUSTIVE at compile
 * time. The union stays here, next to `Role`, because this is where the
 * shape of a role is described; the LABELS deliberately do not, because two
 * areas print them and neither owns them (ADR-022, amended 2026-09-14).
 *
 * A role created through the admin screens is deliberately NOT in this union:
 * its name is whatever a person typed, it has no translation, and it must
 * render exactly as typed.
 *
 * Kept honest against the seed itself by `role-display-name.seed-sync.test.ts`,
 * which reads `platform.seed.ts` from disk — a union that drifts from the seed
 * fails the build of that test rather than degrading the screen in silence.
 */
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

/**
 * Mirrors `RolesSummary` (`GET /admin/roles/summary`, 015-roles-permissions-surface).
 *
 * `totalRoles = systemRoles + customRoles` is an invariant of the endpoint.
 * `usersWithRoles` is `COUNT(DISTINCT user_id)` over `user_roles` — it is
 * NOT the sum of `Role.assignedUserCount`, which counts a person holding two
 * roles twice.
 */
export interface RolesSummary {
  readonly totalRoles: number;
  readonly systemRoles: number;
  readonly customRoles: number;
  readonly usersWithRoles: number;
}

/** Mirrors `WriteRoleRequest` (create). */
export interface WriteRoleRequest {
  readonly name: string;
  readonly description: string;
  readonly permissionIdentifiers: readonly string[];
}

/** Mirrors `UpdateRoleRequest`. */
export interface UpdateRoleRequest {
  readonly name?: string;
  readonly description?: string;
  readonly permissionIdentifiers?: readonly string[];
}

/** Mirrors `OrgUnitNode`. */
export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: AdminUserStatus;
  readonly childCount: number;
}

/** Mirrors `CreateOrgUnitRequest`. */
export interface CreateOrgUnitRequest {
  readonly code: string;
  readonly name: string;
  readonly parentId?: string | null;
}

/** Mirrors `UpdateOrgUnitRequest`. */
export interface UpdateOrgUnitRequest {
  readonly code?: string;
  readonly name?: string;
  readonly parentId?: string | null;
}

/** Mirrors `SetOrgUnitStatusRequest`. */
export interface SetOrgUnitStatusRequest {
  readonly status: AdminUserStatus;
}

/** Mirrors `OrgScopeGrant`. */
export interface OrgScopeGrant {
  readonly id: string;
  readonly scopeType: OrgScopeType;
  readonly orgUnit: AdminOrgUnitRef | null;
  readonly grantedBy?: AdminUserRef;
  readonly grantedAt: string;
}

/** Mirrors `GrantOrgScopeRequest`. */
export interface GrantOrgScopeRequest {
  readonly scopeType: OrgScopeType;
  readonly orgUnitId?: string | null;
}

/** A reduced directory entry, mirrors `UserRef` from `GET /users` (used to search for a user to grant scope to). */
export interface DirectoryUser {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnit?: AdminOrgUnitRef | null;
}

/** Sort fields accepted by `GET /admin/users` (contract enum). */
export type AdminUserSortField = 'fullName' | 'email' | 'status' | 'lastLoginAt';

// ---------------------------------------------------------------------
// Roles surface — client-side view types (015-roles-permissions-surface).
//
// Everything above mirrors a named schema in the contract. The two unions
// below deliberately do NOT: `GET /admin/roles` accepts only `page` and
// `pageSize` (research.md R-009), so search, type filter, module filter and
// ordering all run over the page the screen already holds. They live here,
// next to the administration types, because both the roles screen and the
// pt-BR catalogue (`lib/messages/admin.ts`) need the same union — a label
// map typed `Record<Union, string>` is what makes a missing translation a
// compile error instead of a raw identifier on screen (F-1).
// ---------------------------------------------------------------------

/** Role-kind filter of the roles surface (FR-005); also what the three interactive indicators apply (FR-002). */
export type RoleTypeFilter = 'all' | 'system' | 'custom';

/** Orderings offered by the roles surface (FR-005b), applied client-side. */
export type RoleSortOption = 'name:asc' | 'name:desc' | 'permissions:desc' | 'users:desc';
