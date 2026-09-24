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
