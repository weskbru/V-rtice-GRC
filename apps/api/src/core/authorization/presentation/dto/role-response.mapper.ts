import type { PermissionRecord } from '../../domain/ports/permission-repository.port';
import type { RoleRecord } from '../../domain/ports/role-repository.port';

export interface PermissionResponse {
  readonly identifier: string;
  readonly resource: string;
  readonly action: string;
  readonly description: string;
}

export interface RoleResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isSystem: boolean;
  readonly permissions: readonly PermissionResponse[];
  readonly assignedUserCount: number;
}

export function toPermissionResponse(permission: PermissionRecord): PermissionResponse {
  return {
    identifier: permission.identifier,
    resource: permission.resource,
    action: permission.action,
    description: permission.description,
  };
}

export function toRoleResponse(role: RoleRecord): RoleResponse {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions.map(toPermissionResponse),
    assignedUserCount: role.assignedUserCount,
  };
}
