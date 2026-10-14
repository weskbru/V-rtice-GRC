import type { FrameworkRecord } from '../framework.entity';
import type { FrameworkOrigin } from '@prisma/client';

export interface CreateFrameworkInput {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly origin: FrameworkOrigin;
}

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

  abstract findById(id: string): Promise<FrameworkRecord | undefined>;

  abstract list(query: FrameworkListQuery): Promise<FrameworkListPage>;

  abstract updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: UpdateFrameworkChanges,
  ): Promise<FrameworkUpdateResult>;
}
