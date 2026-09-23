import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ControlEffectiveness } from '../control-effectiveness.service';
import type { ControlFrequency, ControlNature, ControlStatus, ControlType } from '@prisma/client';

export type ControlCatalogSortField =
  'code' | 'name' | 'status' | 'effectiveness' | 'owner' | 'updatedAt';
export type ControlCatalogSortDirection = 'asc' | 'desc';

export interface ControlCatalogFilters {
  readonly q?: string | undefined;
  readonly status?: readonly ControlStatus[] | undefined;
  readonly effectiveness?: readonly ControlEffectiveness[] | undefined;
  readonly nature?: readonly ControlNature[] | undefined;
  readonly type?: readonly ControlType[] | undefined;
  readonly frequency?: readonly ControlFrequency[] | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly ownerUserId?: readonly string[] | undefined;
}

export interface ControlCatalogSort {
  readonly field: ControlCatalogSortField;
  readonly direction: ControlCatalogSortDirection;
}

export interface ControlCatalogQuery {
  readonly scope: ScopeFilter;
  readonly filters: ControlCatalogFilters;
  readonly sort: ControlCatalogSort;
  readonly page: number;
  readonly pageSize: number;
  readonly referenceDate: Date;
}

export interface ControlCatalogRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly description: string | null;
  readonly orgUnit: { readonly id: string; readonly code: string; readonly name: string } | null;
  readonly owner:
    { readonly id: string; readonly fullName: string; readonly email: string } | undefined;
  readonly nature: ControlNature | undefined;
  readonly type: ControlType | undefined;
  readonly frequency: ControlFrequency | undefined;
  readonly status: ControlStatus;
  readonly effectiveness: ControlEffectiveness;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface ControlCatalogPage {
  readonly items: readonly ControlCatalogRow[];
  readonly total: number;
}

export abstract class ControlQueryPort {
  abstract listCatalog(query: ControlCatalogQuery): Promise<ControlCatalogPage>;
}
