/**
 * T020/003-controls-management — port for the control catalog's read model
 * (`contracts/controls.openapi.yaml`'s `GET /controls`, `listControlCatalog`
 * operation). `ListControlsUseCase` depends on this abstract class, never
 * on the Prisma-backed implementation directly (ADR-011) — the same
 * discipline `RiskQueryPort` establishes for the risk register.
 *
 * `scope: ScopeFilter` and `referenceDate: Date` are both required,
 * non-optional parameters — the former is FR-007's mandatory scope
 * predicate (mirroring `RiskQueryPort.listRegister`'s own required
 * `scope`); the latter is `ControlEffectivenessService`'s own discipline of
 * never reading the clock inside a derived-state rule (D-2) — the SQL
 * effectiveness expression (`control-effectiveness-query.ts`) takes the
 * IDENTICAL value this port's caller also would if it computed
 * effectiveness in TypeScript, so there is one "now" per request, not one
 * per row.
 *
 * `infrastructure/control-query.service.ts` is the only implementation.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ControlEffectiveness } from '../control-effectiveness.service';
import type { ControlFrequency, ControlNature, ControlStatus, ControlType } from '@prisma/client';

/** The catalog's `sort` parameter — deliberately narrower than every
 * filterable field (`contracts/controls.openapi.yaml`'s own `sort` enum
 * description: "nature, type and frequency are filterable above but not
 * offered here"). */
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
  /** Always intersected with `scope` by the implementation — narrows,
   * never widens (`contracts/controls.openapi.yaml`'s `orgUnitId`
   * parameter description). */
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

/** One catalog row — `contracts/controls.openapi.yaml`'s `ControlSummary`,
 * exactly as the presentation layer's mapper needs it. */
export interface ControlCatalogRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  /** Task A superset field (`control-response.mapper.ts`'s own header) —
   * the full description, so `ControlSummary` stays a superset of the
   * retired `RegistryItem.description`. */
  readonly description: string | null;
  /** `null` for the vanishingly rare legacy control with no organizational
   * unit at all — see `ControlRepositoryPort.ControlRecord.orgUnit`'s own
   * doc comment for why this is a genuine "não com valor arbitrado" case
   * rather than a gap. */
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
