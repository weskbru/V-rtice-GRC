/**
 * 2026-09-13 (015-roles-permissions-surface, T011) — `GET
 * /admin/roles/summary`'s own use case
 * (`specs/001-grc-platform-foundation/contracts/admin.openapi.yaml`'s
 * `getRolesSummary` operation, FR-039 to FR-043).
 *
 * ## Why a use case of its own, and not a method on `RoleAdminService`
 *
 * `RoleAdminService` is this capability's WRITE service: every other method
 * on it resolves an actor label, opens a transaction, records audit rows and
 * bumps `permissionsVersion` — which is why it depends on five
 * collaborators (`RoleRepositoryPort`, `PermissionRepositoryPort`,
 * `ActorDirectoryPort`, `TransactionRunnerPort`, `AuditRecorder`). This
 * operation is read-only, writes nothing, audits nothing and needs exactly
 * one of those five. Folding it in would mean its unit test had to stand up
 * four stubs it never calls, and would blur a service whose header
 * documents an invalidation contract that has nothing to do with counting.
 * `modules/dashboard`'s `GetDashboardSummaryUseCase` is the same shape for
 * the same reason.
 *
 * ## Deliberately a pass-through, and deliberately NOT a validator
 *
 * `totalRoles = systemRoles + customRoles` is an invariant of the data
 * (`plan.md` §4) and is asserted BY TEST against a real database, never
 * enforced here with a runtime check. The three counts are three
 * independent aggregates read without a snapshot: a role created between
 * two of them would transiently break the identity, and a guard throwing on
 * that would turn a correct-in-a-moment read into a 500. The invariant is a
 * property to verify, not a precondition to police.
 *
 * ## Authorization and scope
 *
 * Nothing here checks permissions: `AdminRolesController`'s
 * `@RequirePermission('role:administer')` and the global `PermissionGuard`
 * are the single decision path (ADR-003), the same one every other
 * `/admin/roles` operation goes through (FR-041, CLAUDE.md §19.8). Roles
 * are platform-wide administrative records, not organizationally scoped
 * ones — no `ScopeFilter` applies, exactly as `RoleAdminService.list` and
 * `getById` already work.
 */
import { Injectable } from '@nestjs/common';

import { RoleRepositoryPort } from '../domain/ports/role-repository.port';

import type { RoleSummaryCounts } from '../domain/ports/role-repository.port';

export type RolesSummaryOutput = RoleSummaryCounts;

@Injectable()
export class GetRolesSummaryUseCase {
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute(): Promise<RolesSummaryOutput> {
    return this.roleRepository.getSummaryCounts();
  }
}
