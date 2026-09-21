/**
 * 2026-09-13 (015-roles-permissions-surface, T013) — maps
 * `RolesSummaryOutput` (domain-shaped) to
 * `contracts/admin.openapi.yaml`'s `RolesSummary` response schema, in the
 * same shape `role-response.mapper.ts` uses for `Role`/`Permission`.
 *
 * The mapping is field-for-field with no renaming, and it is written out
 * explicitly rather than returned by spreading the input: an explicit
 * mapper is what keeps the wire contract from silently acquiring whatever
 * a future `RoleSummaryCounts` grows, and it is the thing a unit test can
 * catch a swapped `systemRoles`/`customRoles` in.
 */
import type { RolesSummaryOutput } from '../../application/get-roles-summary.usecase';

export interface RolesSummaryResponse {
  readonly totalRoles: number;
  readonly systemRoles: number;
  readonly customRoles: number;
  readonly usersWithRoles: number;
}

export function toRolesSummaryResponse(summary: RolesSummaryOutput): RolesSummaryResponse {
  return {
    totalRoles: summary.totalRoles,
    systemRoles: summary.systemRoles,
    customRoles: summary.customRoles,
    usersWithRoles: summary.usersWithRoles,
  };
}
