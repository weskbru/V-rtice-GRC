/**
 * T017-T021/006-assets-processes — `AssetRepositoryPort`, the port every
 * Asset use case depends on (ADR-011) — never on the Prisma-backed
 * implementation directly. Mirrors
 * `grc/finding/domain/ports/finding-repository.port.ts`'s shape: `Asset`
 * carries no `version` column (data-model.md §1), so there is no
 * `If-Match`/`expectedVersion` shape here, and `deactivate`/`reactivate`
 * are two DEDICATED methods (data-model.md §3: exactly two states, exactly
 * two edges) rather than one generic `transition`.
 *
 * `infrastructure/prisma-asset.repository.ts` is the only implementation.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';

export interface AssetOrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** The minimal, read-only projection of a `Risk`/`Control` this module
 * ever shows (contracts/assets.openapi.yaml's `RiskRef`/`ControlRef`,
 * ADR-020 part 4) — id plus the record's own display field only. */
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

/** One `Asset`, exactly as the presentation layer's mapper needs it —
 * every relation already resolved, mirroring `ControlRecord`'s
 * convention. `risks`/`controls` are populated only by `findById` (the
 * `AssetDetail` shape, FR-008); `list`'s own summary rows never carry
 * them. */
export interface AssetRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | undefined;
  /** `undefined` only for the handful of rows created before this module
   * existed (research.md D-2) — every row THIS module creates always has
   * one (`CreateAssetRequest.orgUnitId` is required, Invariant A1). */
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

/** `undefined` means "leave unchanged" — the same convention
 * `UpdateControlChanges`/`UpdateFindingChanges` establish. No `isActive`:
 * `update` never changes situation (contract's own description) — see
 * `deactivate`/`reactivate` below for that path. */
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

/** One catalog row — `contracts/assets.openapi.yaml`'s `AssetSummary`.
 * Never carries `risks`/`controls` — those are `AssetDetail`-only
 * (FR-008), read by `findById` alone. */
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

  /** `undefined` when the asset does not exist OR exists outside `scope`
   * — the two are indistinguishable by design (FR-010). Includes the
   * currently-linked risks/controls (FR-008). */
  abstract findById(scope: ScopeFilter, id: string): Promise<AssetRecord | undefined>;

  /** F-38 mechanism — an UNSCOPED lookup of `id`'s CURRENT `orgUnitId`,
   * ignoring `scope` entirely. Used EXCLUSIVELY on the refusal path, after
   * a scoped lookup already returned nothing, so
   * `OrgScopeEnforcerService.assertExistingRecordAccessible` can tell
   * "does not exist" apart from "exists outside scope". `undefined` when
   * the row has no organizational unit recorded at all (research.md D-2)
   * — such a row is invisible to any scope-by-unit caller regardless, so
   * there is nothing to compare it against. */
  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  /** Scoped conditional update. `undefined` under the same out-of-scope/
   * not-found rule as `findById`. */
  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateAssetChanges,
  ): Promise<AssetRecord | undefined>;

  /** Sets `isActive = false`. `undefined` under the same rule as
   * `update`. The caller has already checked the current situation before
   * calling this (data-model.md §3: refused with `422` if already
   * inactive). */
  abstract deactivate(scope: ScopeFilter, id: string): Promise<AssetRecord | undefined>;

  /** Sets `isActive = true`. Same contract as `deactivate`. */
  abstract reactivate(scope: ScopeFilter, id: string): Promise<AssetRecord | undefined>;

  abstract list(
    scope: ScopeFilter,
    filter: AssetListFilter,
    sort: AssetListSort,
    page: number,
    pageSize: number,
  ): Promise<AssetListResult>;
}
