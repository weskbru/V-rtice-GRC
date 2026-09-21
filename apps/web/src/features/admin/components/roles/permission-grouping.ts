/**
 * PharosGRC — Administration, shared permission-grouping helpers (T182, wave
 * 4). Groups a permission list so composing/reading a role's dozens of
 * `resource:action` identifiers stays legible.
 *
 * Two groupings, both over the catalogue as the server returns it — neither
 * renames, drops nor reorders an identifier:
 *
 * - `groupPermissionsByResource` — one group per `resource`. Still used by
 *   `RolePermissionsSummary` (the users screen's role-assignment dialog).
 * - `groupPermissionsByArea` — one group per platform AREA (the same areas
 *   the navigation shows: Riscos, Controles, Auditoria…), each holding its
 *   resources. Used by the roles list, the module filter, the detail panel
 *   and the role form (reading, editing and composing alike), so a role is
 *   read and composed in the vocabulary of the product rather than of the
 *   database. A resource this map does not know yet lands in `other` under
 *   its raw identifier — a catalogue entry added later is never hidden.
 *
 * `permissionMatchesQuery` / `filterPermissionsByQuery` are the search that
 * used to live inside `PermissionChecklist`, kept when that component was
 * retired with the create dialog it served.
 */
import { admin } from '@/lib/messages/admin';

import type { Permission } from '../../types';

export interface PermissionGroup {
  readonly resource: string;
  readonly permissions: readonly Permission[];
}

/** Groups `permissions` by `resource`, resources sorted alphabetically — never re-sorting permissions within a group (the catalogue's own order is preserved). */
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

/**
 * Area order follows the sidebar (GRC modules first, administration last);
 * `other` always closes the list.
 *
 * Exported because the roles surface's module filter offers these same
 * areas in this same order (015 FR-013 — "creating a second taxonomy is
 * forbidden"). Deriving that list from the message catalogue's key order
 * instead would work only for as long as the two happened to agree.
 */
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

/** The area each resource belongs to. Key order doubles as resource order inside an area: the area's own subject first, its satellites after. */
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

/** Readable verb for one permission, from its identifier's own verb (`control:test` → "Testar"); falls back to the raw verb. */
export function permissionVerbLabel(permission: Permission): string {
  const separator = permission.identifier.indexOf(':');
  const verb =
    separator >= 0 ? permission.identifier.slice(separator + 1) : permission.action.toLowerCase();
  return admin.roles.permissionCatalog.verbs[verb] ?? verb;
}

/**
 * Whether one permission matches a free-text query.
 *
 * Migrated verbatim from `PermissionChecklist`, which owned this predicate
 * until the create dialog it lived in was replaced by the create panel. The
 * five fields it looks at are the point: the raw identifier and the (still
 * English, F-63) catalogue description, PLUS the pt-BR verb, resource and
 * module names. Without the pt-BR half, typing "Testar" would not find
 * `control:test` — whose `action` is `ASSESS` and whose description is in
 * English — and a reader searching in the language the screen is written in
 * would find nothing.
 *
 * An empty or blank query matches everything, so callers do not have to
 * special-case it.
 */
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

/** `permissions` narrowed to those matching `query`, in the catalogue's own order. Returns the input unchanged for a blank query. */
export function filterPermissionsByQuery(
  permissions: readonly Permission[],
  query: string,
): readonly Permission[] {
  if (query.trim() === '') return permissions;
  return permissions.filter((permission) => permissionMatchesQuery(permission, query));
}

/** Groups `permissions` by platform area, then by resource. Areas and resources follow a fixed product order; permissions keep the catalogue's own order. */
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
