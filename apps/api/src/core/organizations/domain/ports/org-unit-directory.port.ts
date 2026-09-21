/**
 * T096a — port backing `GET /org-units` (`contracts/admin.openapi.yaml`):
 * the organizational-unit tree nodes within the caller's resolved scope, for
 * ordinary business forms (e.g. the risk create/edit form's organizational
 * unit select) — distinct from `OrgScopeRepositoryPort` (T039), which
 * resolves WHICH units a caller may see but never returns a unit's own
 * displayable fields (`code`/`name`/`status`/`childCount`).
 *
 * `core/organizations/application` depends on this abstract class — never on
 * `PrismaService` directly (ADR-011).
 * `core/organizations/infrastructure/prisma-org-unit-directory.repository.ts`
 * is the only implementation, wired in `organizations.module.ts`.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';

export type OrgUnitDirectoryStatus = 'ACTIVE' | 'INACTIVE';

/** One row of `GET /org-units` — mirrors `OrgUnitNode`
 * (`contracts/admin.openapi.yaml`). */
export interface OrgUnitNodeRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | undefined;
  readonly depth: number;
  readonly status: OrgUnitDirectoryStatus;
  readonly childCount: number;
}

export abstract class OrgUnitDirectoryPort {
  /**
   * Units matching `status`, restricted to `scope` (a `GLOBAL` scope sees
   * every matching unit; a `UNIT` scope — including the empty set, "no
   * grants at all" — sees only units whose own id is in that set), ordered
   * by the materialized path so a caller can render the tree directly
   * without a second sort (contract: "ordered by materialized path").
   */
  abstract listInScope(
    scope: ScopeFilter,
    status: OrgUnitDirectoryStatus,
  ): Promise<readonly OrgUnitNodeRecord[]>;
}
