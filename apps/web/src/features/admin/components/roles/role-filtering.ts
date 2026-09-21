/**
 * PharosGRC — Administration, the roles surface's own search, filter and
 * ordering (015-roles-permissions-surface FR-005, FR-005a, FR-005b,
 * FR-005c, FR-007).
 *
 * All four run over the page the screen already loaded, and deliberately so:
 * `GET /admin/roles` accepts exactly `page` and `pageSize` — no `q`, no
 * `sort`, no module — and roles are a bounded set the contract itself
 * describes that way (research.md R-009). The module filter in particular
 * COULD NOT run on the server today: `PermissionArea` is a client-side
 * taxonomy (`permission-grouping.ts`), because `PermissionDefinition` has
 * four fields and none of them is an area.
 *
 * Pure functions, no React, no I/O — so the ordering and the "which modules
 * does this role reach" rule are testable without mounting a screen, and so
 * there is exactly ONE implementation of each (CLAUDE.md §19.7).
 */
import { roleDisplayName } from '@/lib/role-display-name';

import { groupPermissionsByArea } from './permission-grouping';

import type { PermissionArea } from './permission-grouping';
import type { Role, RoleSortOption, RoleTypeFilter } from '../../types';

/** One module a role reaches, with how many of that module's permissions it grants. */
export interface RoleModuleReach {
  readonly area: PermissionArea;
  readonly label: string;
  readonly permissionCount: number;
}

/**
 * The modules a role reaches, ORDERED BY CONCENTRATION — most permissions
 * first, product order breaking ties (`specs/012-admin-roles-screen/STATE.md`
 * §2.3, kept by `spec.md` FR-007).
 *
 * This ordering was measured, not assumed. In product order alone nearly
 * every role opened with "Riscos · Planos de Ação" — most roles hold a
 * `:view` in both — and the Audit Lead read as a risk role. Sorting by
 * concentration puts each role's own centre of gravity first.
 *
 * `groupPermissionsByArea` already returns areas in product order, and
 * `Array.prototype.sort` is stable by specification, so a plain descending
 * sort on the count preserves product order within a tie without a second
 * comparison.
 */
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
  /** Free text, matched against the role's name and description. */
  readonly q: string;
  readonly type: RoleTypeFilter;
  /** A `PermissionArea`, or `undefined` for "every module". */
  readonly module: PermissionArea | undefined;
}

/**
 * Whether one role survives the current search and filters.
 *
 * FR-005a, stated as code: a role matches a module when it grants AT LEAST
 * ONE permission of that module, so a role with no permissions at all
 * matches no module — never "all of them" by vacuous truth.
 */
export function roleMatchesCriteria(role: Role, criteria: RoleFilterCriteria): boolean {
  if (criteria.type === 'system' && !role.isSystem) return false;
  if (criteria.type === 'custom' && role.isSystem) return false;

  if (criteria.module !== undefined) {
    const reaches = roleModuleReach(role).some((module) => module.area === criteria.module);
    if (!reaches) return false;
  }

  const term = criteria.q.trim().toLocaleLowerCase('pt-BR');
  if (term === '') return true;
  // Both names, deliberately (ADR-022): the reader who types "Administrador"
  // saw that word on this screen, and the reader who types "Platform" saw it
  // in an API response, an audit entry or a runbook. Neither may come up
  // empty-handed for the same role. For a custom role the two are the same
  // string, and the extra test costs nothing.
  return (
    roleDisplayName(role.name).toLocaleLowerCase('pt-BR').includes(term) ||
    role.name.toLocaleLowerCase('pt-BR').includes(term) ||
    role.description.toLocaleLowerCase('pt-BR').includes(term)
  );
}

/**
 * Orders a list of roles by one of the presets `spec.md` FR-005b names.
 *
 * Every ordering falls back to the role name so the result is total and
 * therefore stable: two roles with the same permission count must not swap
 * places between renders, which is what a comparator returning 0 for
 * distinct rows invites.
 *
 * The name compared is the DISPLAYED one (ADR-022). "Nome (A–Z)" over a list
 * that reads "Administrador da Plataforma, Analista de Riscos, Aprovador…"
 * has to be alphabetical in those words — ordering by the stored
 * `Platform Administrator` would put it between "Líder de Auditoria" and
 * "Somente Leitura" and look simply broken.
 */
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

/** Search + filters + ordering, in the one order that makes the results line honest: narrow first, then order what is left. */
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
