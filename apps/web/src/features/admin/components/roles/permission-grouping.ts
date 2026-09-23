import { admin } from '@/lib/messages/admin';

import type { Permission } from '../../types';

export interface PermissionGroup {
  readonly resource: string;
  readonly permissions: readonly Permission[];
}

export function groupPermissionsByResource(
  permissions: readonly Permission[],
): readonly PermissionGroup[] {
  const byResource = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const group = byResource.get(permission.resource) ?? [];
    group.push(permission);
    byResource.set(permission.resource, group);
  }
  return Array.from(byResource.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resource, items]) => ({ resource, permissions: items }));
}

export type PermissionArea = keyof typeof admin.roles.permissionCatalog.areas;

export const PERMISSION_AREA_ORDER: readonly PermissionArea[] = [
  'risk',
  'action',
  'problem',
  'incident',
  'control',
  'asset',
  'process',
  'compliance',
  'audit',
  'indicator',
  'report',
  'collaboration',
  'administration',
  'other',
];

const RESOURCE_AREA: Readonly<Record<string, PermissionArea>> = {
  risk: 'risk',
  methodology: 'risk',
  action: 'action',
  problem: 'problem',
  incident: 'incident',
  control: 'control',
  asset: 'asset',
  process: 'process',
  compliance: 'compliance',
  'audit-engagement': 'audit',
  finding: 'audit',
  indicator: 'indicator',
  report: 'report',
  evidence: 'collaboration',
  comment: 'collaboration',
  attachment: 'collaboration',
  user: 'administration',
  role: 'administration',
  org_unit: 'administration',
  audit: 'administration',
};

const RESOURCE_ORDER: readonly string[] = Object.keys(RESOURCE_AREA);

export interface PermissionResourceGroup {
  readonly resource: string;
  readonly label: string;
  readonly permissions: readonly Permission[];
}

export interface PermissionAreaGroup {
  readonly area: PermissionArea;
  readonly label: string;
  readonly resources: readonly PermissionResourceGroup[];
  readonly permissionCount: number;
}

export function areaForResource(resource: string): PermissionArea {
  return RESOURCE_AREA[resource] ?? 'other';
}

export function resourceLabel(resource: string): string {
  return admin.roles.permissionCatalog.resources[resource] ?? resource;
}

export function permissionVerbLabel(permission: Permission): string {
  const separator = permission.identifier.indexOf(':');
  const verb =
    separator >= 0 ? permission.identifier.slice(separator + 1) : permission.action.toLowerCase();
  return admin.roles.permissionCatalog.verbs[verb] ?? verb;
}

export function permissionMatchesQuery(permission: Permission, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return [
    permission.identifier,
    permission.description,
    permissionVerbLabel(permission),
    resourceLabel(permission.resource),
    admin.roles.permissionCatalog.areas[areaForResource(permission.resource)],
  ].some((text) => text.toLowerCase().includes(needle));
}

export function filterPermissionsByQuery(
  permissions: readonly Permission[],
  query: string,
): readonly Permission[] {
  if (query.trim() === '') return permissions;
  return permissions.filter((permission) => permissionMatchesQuery(permission, query));
}

export function groupPermissionsByArea(
  permissions: readonly Permission[],
): readonly PermissionAreaGroup[] {
  const byArea = new Map<PermissionArea, Map<string, Permission[]>>();
  for (const permission of permissions) {
    const area = areaForResource(permission.resource);
    const resources = byArea.get(area) ?? new Map<string, Permission[]>();
    const items = resources.get(permission.resource) ?? [];
    items.push(permission);
    resources.set(permission.resource, items);
    byArea.set(area, resources);
  }

  const resourceRank = (resource: string): number => {
    const index = RESOURCE_ORDER.indexOf(resource);
    return index === -1 ? RESOURCE_ORDER.length : index;
  };

  return PERMISSION_AREA_ORDER.filter((area) => byArea.has(area)).map((area) => {
    const resources = Array.from(byArea.get(area)?.entries() ?? [])
      .sort(([a], [b]) => resourceRank(a) - resourceRank(b) || a.localeCompare(b))
      .map(([resource, items]) => ({
        resource,
        label: resourceLabel(resource),
        permissions: items,
      }));
    return {
      area,
      label: admin.roles.permissionCatalog.areas[area],
      resources,
      permissionCount: resources.reduce((total, group) => total + group.permissions.length, 0),
    };
  });
}
