/**
 * T020/004-compliance-management — port for persisting and reading
 * `Framework` records (contract operations 1-4). The create/read/list/
 * update use cases depend on this abstract class, never on the
 * Prisma-backed implementation directly (ADR-011).
 *
 * No `ScopeFilter` anywhere in this file — `Framework` is a platform-wide
 * catalog gated only by `compliance:*` permission (research.md D-2); a
 * `ScopedRepository` here would be exactly the reintroduced defect
 * `compliance-catalog-unscoped.spec.ts` (T018) guards against.
 */
import type { FrameworkRecord } from '../framework.entity';
import type { FrameworkOrigin } from '@prisma/client';

export interface CreateFrameworkInput {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly origin: FrameworkOrigin;
}

/** `undefined` = leave unchanged (partial-update semantics, mirroring
 * `UpdateControlChanges`). */
export interface UpdateFrameworkChanges {
  readonly name?: string;
  readonly description?: string;
  readonly origin?: FrameworkOrigin;
}

export type FrameworkUpdateResult =
  | { readonly outcome: 'UPDATED'; readonly record: FrameworkRecord }
  | { readonly outcome: 'NOT_FOUND' }
  | { readonly outcome: 'VERSION_CONFLICT'; readonly currentVersion: number };

export type FrameworkListSortField = 'code' | 'name' | 'updatedAt';
export type FrameworkListSortDirection = 'asc' | 'desc';

export interface FrameworkListFilters {
  readonly q?: string | undefined;
  readonly origin?: readonly FrameworkOrigin[] | undefined;
}

export interface FrameworkListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly filters: FrameworkListFilters;
  readonly sortField: FrameworkListSortField;
  readonly sortDirection: FrameworkListSortDirection;
}

export interface FrameworkListPage {
  readonly items: readonly FrameworkRecord[];
  readonly total: number;
}

export abstract class FrameworkRepositoryPort {
  abstract create(input: CreateFrameworkInput): Promise<FrameworkRecord>;

  /** `undefined` when no framework with this id exists — never filtered by
   * scope (research.md D-2). */
  abstract findById(id: string): Promise<FrameworkRecord | undefined>;

  abstract list(query: FrameworkListQuery): Promise<FrameworkListPage>;

  /**
   * Applies `changes` iff the row's current `version` equals
   * `expectedVersion` — the same race-free single conditional `UPDATE
   * ... WHERE id = ? AND version = ?` mechanism `ControlRepository
   * .updateWithVersion` documents (ADR-013), minus any scope predicate.
   */
  abstract updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: UpdateFrameworkChanges,
  ): Promise<FrameworkUpdateResult>;
}
