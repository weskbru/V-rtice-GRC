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

  setUserStatus(userId: string, body: SetUserStatusRequest): Promise<AdminUserDetail> {
    return apiClient.put<AdminUserDetail>(`/admin/users/${userId}/status`, body);
  },

  resetUserPassword(userId: string, body: ResetUserPasswordRequest): Promise<void> {
    return apiClient.put<void>(`/admin/users/${userId}/password`, body);
  },

  revokeUserSessions(userId: string): Promise<void> {
    return apiClient.delete<void>(`/admin/users/${userId}/sessions`);
  },

  replaceUserRoles(userId: string, body: ReplaceUserRolesRequest): Promise<UserRoleAssignment> {
    return apiClient.put<UserRoleAssignment>(`/admin/users/${userId}/roles`, body);
  },

  listUserScopeGrants(userId: string): Promise<readonly OrgScopeGrant[]> {
    return apiClient.get<readonly OrgScopeGrant[]>(`/admin/users/${userId}/scope-grants`);
  },

  grantUserScope(userId: string, body: GrantOrgScopeRequest): Promise<OrgScopeGrant> {
    return apiClient.post<OrgScopeGrant>(`/admin/users/${userId}/scope-grants`, body);
  },

  revokeUserScope(userId: string, grantId: string): Promise<void> {
    return apiClient.delete<void>(`/admin/users/${userId}/scope-grants/${grantId}`);
  },

  listRoles(page: number, pageSize: number): Promise<Page<Role>> {
    return apiClient.get<Page<Role>>(`/admin/roles?page=${page}&pageSize=${pageSize}`);
  },

  getRolesSummary(): Promise<RolesSummary> {
    return apiClient.get<RolesSummary>('/admin/roles/summary');
  },

  getRole(roleId: string): Promise<Role> {
    return apiClient.get<Role>(`/admin/roles/${roleId}`);
  },

  createRole(body: WriteRoleRequest): Promise<Role> {
    return apiClient.post<Role>('/admin/roles', body);
  },

  updateRole(roleId: string, body: UpdateRoleRequest): Promise<Role> {
    return apiClient.patch<Role>(`/admin/roles/${roleId}`, body);
  },

  deleteRole(roleId: string): Promise<void> {
    return apiClient.delete<void>(`/admin/roles/${roleId}`);
  },

  listPermissions(resource?: string): Promise<readonly Permission[]> {
    return apiClient.get<readonly Permission[]>(
      `/admin/permissions${resource ? `?resource=${encodeURIComponent(resource)}` : ''}`,
    );
  },

  listOrgUnits(status?: 'ACTIVE' | 'INACTIVE'): Promise<readonly OrgUnitNode[]> {
    return apiClient.get<readonly OrgUnitNode[]>(
      `/admin/org-units${status ? `?status=${status}` : ''}`,
    );
  },

  createOrgUnit(body: CreateOrgUnitRequest): Promise<OrgUnitNode> {
    return apiClient.post<OrgUnitNode>('/admin/org-units', body);
  },

  updateOrgUnit(orgUnitId: string, body: UpdateOrgUnitRequest): Promise<OrgUnitNode> {
    return apiClient.patch<OrgUnitNode>(`/admin/org-units/${orgUnitId}`, body);
  },

  setOrgUnitStatus(orgUnitId: string, body: SetOrgUnitStatusRequest): Promise<OrgUnitNode> {
    return apiClient.put<OrgUnitNode>(`/admin/org-units/${orgUnitId}/status`, body);
  },

  async searchDirectoryUsers(q: string): Promise<readonly DirectoryUser[]> {
    const params = new URLSearchParams({ page: '1', pageSize: '25' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<DirectoryUser>>(`/users?${params.toString()}`);
    return page.data;
  },
};
