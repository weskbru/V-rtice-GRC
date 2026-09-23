import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';

export interface ProcessOrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ProcessLinkedRiskRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface ProcessLinkedControlRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ProcessRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly orgUnit: ProcessOrgUnitRefRecord | undefined;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly risks: readonly ProcessLinkedRiskRecord[];
  readonly controls: readonly ProcessLinkedControlRecord[];
}

export interface CreateProcessRecordInput {
  readonly code: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly orgUnitId: string;
}

export interface UpdateProcessChanges {
  readonly name?: string;
  readonly description?: string;
  readonly orgUnitId?: string;
}

export type ProcessCatalogSortField = 'code' | 'name' | 'updatedAt';
export type ProcessCatalogSortDirection = 'asc' | 'desc';

export interface ProcessListFilter {
  readonly q?: string | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly isActive?: boolean | undefined;
}

export interface ProcessListSort {
  readonly field: ProcessCatalogSortField;
  readonly direction: ProcessCatalogSortDirection;
}

export interface ProcessSummaryRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly orgUnit: ProcessOrgUnitRefRecord | undefined;
  readonly isActive: boolean;
  readonly updatedAt: Date;
}

export interface ProcessListResult {
  readonly items: readonly ProcessSummaryRecord[];
  readonly total: number;
}

export abstract class ProcessRepositoryPort {
  abstract create(input: CreateProcessRecordInput): Promise<ProcessRecord>;

  abstract findById(scope: ScopeFilter, id: string): Promise<ProcessRecord | undefined>;

  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateProcessChanges,
  ): Promise<ProcessRecord | undefined>;

  abstract deactivate(scope: ScopeFilter, id: string): Promise<ProcessRecord | undefined>;

  abstract reactivate(scope: ScopeFilter, id: string): Promise<ProcessRecord | undefined>;

  abstract list(
    scope: ScopeFilter,
    filter: ProcessListFilter,
    sort: ProcessListSort,
    page: number,
    pageSize: number,
  ): Promise<ProcessListResult>;
}
