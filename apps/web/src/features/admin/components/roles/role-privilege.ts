/**
 * PharosGRC — Administration, role privilege classification
 * (015-roles-permissions-surface, ADR-021).
 *
 * ## The boundary, restated here because it is the whole point
 *
 * This module is EXCLUSIVELY presentation. It answers one question for the
 * reader of the roles screen — "can this role rewrite who can do what?" — and
 * it answers it by looking at the permissions `GET /admin/roles` already
 * returned. Nothing else.
 *
 * It is therefore:
 *
 * - **not persisted** — no column, no table, no migration, and no field in
 *   `RoleResponse`. The platform's `Role` has six fields and gains none;
 * - **not part of authorization** — `PermissionGuard`, permission resolution
 *   (`PermissionResolverService`, `PermissionRepositoryPort`), segregation of
 *   duties, organizational scope filtering, record visibility and every other
 *   security decision are forbidden from consulting it, directly or
 *   indirectly, under this or any other name;
 * - **not a privilege-escalation check** — the platform has none today
 *   (documented in `role-admin.service.ts` and declared out of scope by this
 *   phase's spec). This label neither is that check nor substitutes for it.
 *
 * The permission definitions — and only they — remain the single source of
 * truth for access: a person can do what the union of the roles assigned to
 * them grants, and nothing more. If authorization ever consulted this label,
 * the platform would have two axes of authorization, the second one without
 * audit trail, contract or migration, and a change of access could happen
 * with no corresponding audit event (ADR-021, "O que aconteceria se alguém
 * violasse esta fronteira").
 *
 * ## Why these three identifiers and not "any ADMINISTER"
 *
 * `role:administer`, `user:administer` and `org_unit:administer` are exactly
 * the permissions that let their holder change WHO CAN DO WHAT — compose a
 * role, assign it, or reshape the organizational structure that scopes it.
 * Classifying by `action = ADMINISTER` instead would mark 6 of the 12 seeded
 * roles, including roles that cannot alter a single access assignment — a
 * signal that marks half the population distinguishes nothing, and would be
 * a false statement by the interface about the security model (research.md
 * R-001, spec.md D-01).
 */
import type { Role } from '../../types';

/**
 * The three governance permissions that make a role privileged FOR DISPLAY.
 *
 * The identifiers are the server's own, unchanged: they exist with exactly
 * these names in `apps/api/src/core/authorization/domain/permissions.ts`
 * (`user:administer`, `role:administer`, `org_unit:administer`).
 */
export const PRIVILEGED_PERMISSION_IDENTIFIERS: readonly string[] = [
  'role:administer',
  'user:administer',
  'org_unit:administer',
];

/**
 * Whether the roles screen labels `role` as privileged — a pure function of
 * the permission list the role already carries. No I/O, no state, no React,
 * and no caller outside presentation (see this module's header).
 */
export function isPrivilegedRole(role: Pick<Role, 'permissions'>): boolean {
  return role.permissions.some((permission) =>
    PRIVILEGED_PERMISSION_IDENTIFIERS.includes(permission.identifier),
  );
}
