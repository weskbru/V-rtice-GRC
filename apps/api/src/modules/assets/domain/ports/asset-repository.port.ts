import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';

export interface AssetOrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AssetLinkedRiskRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface AssetLinkedControlRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AssetRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly orgUnit: AssetOrgUnitRefRecord | undefined;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly risks: readonly AssetLinkedRiskRecord[];
  readonly controls: readonly AssetLinkedControlRecord[];
}

export interface CreateAssetRecordInput {
  readonly code: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly orgUnitId: string;
}

export interface UpdateAssetChanges {
  readonly name?: string;
  readonly description?: string;
  readonly orgUnitId?: string;
}

export type AssetCatalogSortField = 'code' | 'name' | 'updatedAt';
export type AssetCatalogSortDirection = 'asc' | 'desc';

export interface AssetListFilter {
  readonly q?: string | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly isActive?: boolean | undefined;
}

export interface AssetListSort {
  readonly field: AssetCatalogSortField;
  readonly direction: AssetCatalogSortDirection;
}

export interface AssetSummaryRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly orgUnit: AssetOrgUnitRefRecord | undefined;
  readonly isActive: boolean;
  readonly updatedAt: Date;
}

export interface AssetListResult {
  readonly items: readonly AssetSummaryRecord[];
  readonly total: number;
}

export abstract class AssetRepositoryPort {
  abstract create(input: CreateAssetRecordInput): Promise<AssetRecord>;

  abstract findById(scope: ScopeFilter, id: string): Promise<AssetRecord | undefined>;

  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateAssetChanges,
  ): Promise<AssetRecord | undefined>;

  abstract deactivate(scope: ScopeFilter, id: string): Promise<AssetRecord | undefined>;

  abstract reactivate(scope: ScopeFilter, id: string): Promise<AssetRecord | undefined>;

  abstract list(
    scope: ScopeFilter,
    filter: AssetListFilter,
    sort: AssetListSort,
    page: number,
    pageSize: number,
  ): Promise<AssetListResult>;
}
