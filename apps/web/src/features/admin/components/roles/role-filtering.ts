import { roleDisplayName } from '@/lib/role-display-name';

import { groupPermissionsByArea } from './permission-grouping';

import type { PermissionArea } from './permission-grouping';
import type { Role, RoleSortOption, RoleTypeFilter } from '../../types';

export interface RoleModuleReach {
  readonly area: PermissionArea;
  readonly label: string;
  readonly permissionCount: number;
}

export function roleModuleReach(role: Pick<Role, 'permissions'>): readonly RoleModuleReach[] {
  return [...groupPermissionsByArea(role.permissions)]
    .sort((a, b) => b.permissionCount - a.permissionCount)
    .map((group) => ({
      area: group.area,
      label: group.label,
      permissionCount: group.permissionCount,
    }));
}

export interface RoleFilterCriteria {
  readonly q: string;
  readonly type: RoleTypeFilter;
  readonly module: PermissionArea | undefined;
}

export function roleMatchesCriteria(role: Role, criteria: RoleFilterCriteria): boolean {
  if (criteria.type === 'system' && !role.isSystem) return false;
  if (criteria.type === 'custom' && role.isSystem) return false;

  if (criteria.module !== undefined) {
    const reaches = roleModuleReach(role).some((module) => module.area === criteria.module);
    if (!reaches) return false;
  }

  const term = criteria.q.trim().toLocaleLowerCase('pt-BR');
  if (term === '') return true;
  return (
    roleDisplayName(role.name).toLocaleLowerCase('pt-BR').includes(term) ||
    role.name.toLocaleLowerCase('pt-BR').includes(term) ||
    role.description.toLocaleLowerCase('pt-BR').includes(term)
  );
}

export function sortRoles(roles: readonly Role[], sort: RoleSortOption): readonly Role[] {
  const byName = (a: Role, b: Role): number =>
    roleDisplayName(a.name).localeCompare(roleDisplayName(b.name), 'pt-BR');
  const ordered = [...roles];

  switch (sort) {
    case 'name:desc':
      return ordered.sort((a, b) => byName(b, a));
    case 'permissions:desc':
      return ordered.sort((a, b) => b.permissions.length - a.permissions.length || byName(a, b));
    case 'users:desc':
      return ordered.sort((a, b) => b.assignedUserCount - a.assignedUserCount || byName(a, b));
    case 'name:asc':
    default:
      return ordered.sort(byName);
  }
}

export function applyRoleCriteria(
  roles: readonly Role[],
  criteria: RoleFilterCriteria,
  sort: RoleSortOption,
): readonly Role[] {
  return sortRoles(
    roles.filter((role) => roleMatchesCriteria(role, criteria)),
    sort,
  );
}
