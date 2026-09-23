import type { Role } from '../../types';

export const PRIVILEGED_PERMISSION_IDENTIFIERS: readonly string[] = [
  'role:administer',
  'user:administer',
  'org_unit:administer',
];

export function isPrivilegedRole(role: Pick<Role, 'permissions'>): boolean {
  return role.permissions.some((permission) =>
    PRIVILEGED_PERMISSION_IDENTIFIERS.includes(permission.identifier),
  );
}
