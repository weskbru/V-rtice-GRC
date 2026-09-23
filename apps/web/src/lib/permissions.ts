import { useMemo } from 'react';

import { useAuth } from './auth-context';

export type PermissionId = `${string}:${string}`;

export interface UsePermissionsResult {
  readonly permissions: readonly string[];
  readonly hasPermission: (permission: PermissionId) => boolean;
  readonly hasAnyPermission: (permissions: readonly PermissionId[]) => boolean;
  readonly hasAllPermissions: (permissions: readonly PermissionId[]) => boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { permissions } = useAuth();

  return useMemo(() => {
    const set = new Set(permissions);
    return {
      permissions,
      hasPermission: (permission) => set.has(permission),
      hasAnyPermission: (candidates) => candidates.some((permission) => set.has(permission)),
      hasAllPermissions: (candidates) => candidates.every((permission) => set.has(permission)),
    };
  }, [permissions]);
}
