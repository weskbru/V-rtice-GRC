/**
 * PharosGRC frontend — Administration API wrapper (US8, T181–T183).
 *
 * A thin, typed layer over `apiClient` for `contracts/admin.openapi.yaml`.
 * None of these resources are optimistically locked (no `ETag`/`If-Match` —
 * unlike `features/risks/api.ts`), matching the contract: users, roles and
 * organizational units are administrative records, not risk aggregates.
 */
import { apiClient } from '@/lib/api-client';

import type {
  AdminUser,
  AdminUserDetail,
  AdminUserSortField,
  CreateOrgUnitRequest,
  CreateUserRequest,
  DirectoryUser,
  GrantOrgScopeRequest,
  OrgScopeGrant,
  OrgUnitNode,
  Page,
  Permission,
  ReplaceUserRolesRequest,
  ResetUserPasswordRequest,
  Role,
  RolesSummary,
  SetOrgUnitStatusRequest,
  SetUserStatusRequest,
  UpdateOrgUnitRequest,
  UpdateRoleRequest,
  UpdateUserRequest,
  UserRoleAssignment,
  WriteRoleRequest,
} from './types';

export interface ListUsersQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  orgUnitId?: string;
  roleId?: string;
  sort?: AdminUserSortField;
  direction?: 'asc' | 'desc';
}

function buildUsersQueryString(query: ListUsersQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.status) params.set('status', query.status);
  if (query.orgUnitId) params.set('orgUnitId', query.orgUnitId);
  if (query.roleId) params.set('roleId', query.roleId);
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);
  return params.toString();
}

export const adminApi = {
  // -------------------------------------------------------------------
  // Users (T181, FR-021, FR-023, FR-011, FR-017)
  // -------------------------------------------------------------------

  listUsers(query: ListUsersQuery): Promise<Page<AdminUser>> {
    return apiClient.get<Page<AdminUser>>(`/admin/users?${buildUsersQueryString(query)}`);
  },

  getUser(userId: string): Promise<AdminUserDetail> {
    return apiClient.get<AdminUserDetail>(`/admin/users/${userId}`);
  },

  createUser(body: CreateUserRequest): Promise<AdminUser> {
    return apiClient.post<AdminUser>('/admin/users', body);
  },

  updateUser(userId: string, body: UpdateUserRequest): Promise<AdminUserDetail> {
    return apiClient.patch<AdminUserDetail>(`/admin/users/${userId}`, body);
  },

  /** `PUT /admin/users/{userId}/status` — deactivating kills every live session (FR-011, FR-015, FR-017). */
  setUserStatus(userId: string, body: SetUserStatusRequest): Promise<AdminUserDetail> {
    return apiClient.put<AdminUserDetail>(`/admin/users/${userId}/status`, body);
  },

  /** `PUT /admin/users/{userId}/password` — also revokes every session the user holds (FR-017). */
  resetUserPassword(userId: string, body: ResetUserPasswordRequest): Promise<void> {
    return apiClient.put<void>(`/admin/users/${userId}/password`, body);
  },

  /** `DELETE /admin/users/{userId}/sessions` — signs the user out everywhere (FR-015, FR-018). */
  revokeUserSessions(userId: string): Promise<void> {
    return apiClient.delete<void>(`/admin/users/${userId}/sessions`);
  },

  /**
   * `PUT /admin/users/{userId}/roles` — replaces the complete set; takes
   * effect on the user's next request (FR-028). Answers
   * `UserRoleAssignment`, not the administrative user record: this is the
   * one `/admin/users**` operation `role:administer` reaches without
   * `user:administer`, so its response is minimized (F-73).
   */
  replaceUserRoles(userId: string, body: ReplaceUserRolesRequest): Promise<UserRoleAssignment> {
    return apiClient.put<UserRoleAssignment>(`/admin/users/${userId}/roles`, body);
  },

  // -------------------------------------------------------------------
  // Organizational scope grants (FR-025a, FR-025b, FR-028)
  // -------------------------------------------------------------------

  listUserScopeGrants(userId: string): Promise<readonly OrgScopeGrant[]> {
    return apiClient.get<readonly OrgScopeGrant[]>(`/admin/users/${userId}/scope-grants`);
  },

  grantUserScope(userId: string, body: GrantOrgScopeRequest): Promise<OrgScopeGrant> {
    return apiClient.post<OrgScopeGrant>(`/admin/users/${userId}/scope-grants`, body);
  },

  revokeUserScope(userId: string, grantId: string): Promise<void> {
    return apiClient.delete<void>(`/admin/users/${userId}/scope-grants/${grantId}`);
  },

  // -------------------------------------------------------------------
  // Roles and permissions (T182, FR-022, FR-023)
  // -------------------------------------------------------------------

  listRoles(page: number, pageSize: number): Promise<Page<Role>> {
    return apiClient.get<Page<Role>>(`/admin/roles?page=${page}&pageSize=${pageSize}`);
  },

  /**
   * `GET /admin/roles/summary` — the four aggregate figures of the roles
   * surface, behind `role:administer` like every other role operation
   * (015-roles-permissions-surface FR-039). One request, constant in the
   * number of roles: the screen never derives these from the listing, and
   * `usersWithRoles` in particular is not derivable from it at all
   * (summing `assignedUserCount` counts a person with two roles twice).
   */
  getRolesSummary(): Promise<RolesSummary> {
    return apiClient.get<RolesSummary>('/admin/roles/summary');
  },

  getRole(roleId: string): Promise<Role> {
    return apiClient.get<Role>(`/admin/roles/${roleId}`);
  },

  createRole(body: WriteRoleRequest): Promise<Role> {
    return apiClient.post<Role>('/admin/roles', body);
  },

  /** `PATCH /admin/roles/{roleId}` — a permission change takes effect on the affected users' NEXT request (FR-028), not immediately for an already-open session. */
  updateRole(roleId: string, body: UpdateRoleRequest): Promise<Role> {
    return apiClient.patch<Role>(`/admin/roles/${roleId}`, body);
  },

  deleteRole(roleId: string): Promise<void> {
    return apiClient.delete<void>(`/admin/roles/${roleId}`);
  },

  /** `GET /admin/permissions` — the seeded, read-only catalogue used to compose a role. */
  listPermissions(resource?: string): Promise<readonly Permission[]> {
    return apiClient.get<readonly Permission[]>(
      `/admin/permissions${resource ? `?resource=${encodeURIComponent(resource)}` : ''}`,
    );
  },

  // -------------------------------------------------------------------
  // Organizational units (T183, FR-024, FR-025b, ADR-004)
  // -------------------------------------------------------------------

  listOrgUnits(status?: 'ACTIVE' | 'INACTIVE'): Promise<readonly OrgUnitNode[]> {
    return apiClient.get<readonly OrgUnitNode[]>(
      `/admin/org-units${status ? `?status=${status}` : ''}`,
    );
  },

  createOrgUnit(body: CreateOrgUnitRequest): Promise<OrgUnitNode> {
    return apiClient.post<OrgUnitNode>('/admin/org-units', body);
  },

  /** `PATCH /admin/org-units/{orgUnitId}` — a `parentId` change reparents the whole subtree (ADR-004); a cycle is refused with 422. */
  updateOrgUnit(orgUnitId: string, body: UpdateOrgUnitRequest): Promise<OrgUnitNode> {
    return apiClient.patch<OrgUnitNode>(`/admin/org-units/${orgUnitId}`, body);
  },

  setOrgUnitStatus(orgUnitId: string, body: SetOrgUnitStatusRequest): Promise<OrgUnitNode> {
    return apiClient.put<OrgUnitNode>(`/admin/org-units/${orgUnitId}/status`, body);
  },

  // -------------------------------------------------------------------
  // Directory lookup (no administrative permission required — used to
  // search for a user to grant organizational scope to)
  // -------------------------------------------------------------------

  async searchDirectoryUsers(q: string): Promise<readonly DirectoryUser[]> {
    const params = new URLSearchParams({ page: '1', pageSize: '25' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<DirectoryUser>>(`/users?${params.toString()}`);
    return page.data;
  },
};
