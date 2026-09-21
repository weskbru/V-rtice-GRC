/**
 * PharosGRC frontend — Asset Management types (T044, 006-assets-processes).
 *
 * Hand-written against `specs/006-assets-processes/contracts/
 * assets.openapi.yaml`, mirroring the same discipline `features/controls/
 * types.ts`/`features/audit-engagements/types.ts` already established:
 * every shape below names a real schema in that contract, and every field
 * the contract marks `readOnly` (or documents as server-computed — `id`,
 * `code`, `orgUnit`, `isActive`, `updatedAt`, `createdAt`, `risks`,
 * `controls`) is response-only here. No request type in this file can even
 * express `code` or `isActive` (invariant A6, data-model.md §4) — exactly as
 * the global validation pipe rejects them as unknown properties.
 *
 * **No optimistic locking, deliberately.** `assets` carries no `version`
 * column, and this contract's own top-level description explains why it
 * "deliberately does not invent one": no operation declares `If-Match`, no
 * response declares `ETag`, and no response uses `409` for a version
 * conflict. Consequently this file declares no `VersionConflictProblem` and
 * no `*WithEtag`/`*WithVersion` wrapper type — unlike `features/controls/
 * types.ts`'s `ControlWithVersion` or `features/audit-engagements/types.ts`'s
 * `AuditEngagementWithEtag`. `features/assets/api.ts` uses only the plain,
 * non-`WithMeta` methods of `apiClient`.
 *
 * Deliberately self-contained (CLAUDE.md §2, §4, §19 — business modules must
 * not depend directly on each other): `OrgUnitRef`, `RiskRef`, `ControlRef`
 * and `OrgUnitNode` below are declared locally rather than imported from
 * `features/controls/types`/`features/risks/types`/`features/audit-
 * engagements/types`, exactly as those modules' own files each declare
 * their own local copy instead of importing one another's.
 */

export type SortDirection = 'asc' | 'desc';

/** Mirrors the `sort` enum of `GET /assets` (`listAssetCatalog`). */
export type AssetListSortField = 'code' | 'name' | 'updatedAt';

/** Mirrors `OrgUnitRef` (assets.openapi.yaml) — `{id, code, name}`, the same shape `features/controls/types.ts`'s/`features/risks/types.ts`'s own `OrgUnitRef` carries. Distinct from `features/audit-engagements/types.ts`'s `{id, name}` copy (that contract's own, narrower schema) — see this module's own `types.test.ts` for the compile-time regression this distinction guards against. */
export interface OrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `RiskRef` (assets.openapi.yaml, ADR-020 part 4) — the minimal, read-only projection of a `Risk` this API ever shows: id, code and title only, never status, owner or risk level. */
export interface RiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

/** Mirrors `ControlRef` (assets.openapi.yaml, ADR-020 part 4) — id, code and name only, never status, owner or effectiveness. */
export interface ControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `OrgUnitNode` (admin.openapi.yaml) — `GET /org-units`, reused identically to `features/controls/types.ts`'s/`features/audit-engagements/types.ts`'s own declaration (all three mirror the same server schema; declaring it locally keeps this feature self-contained). */
export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

/** Mirrors `AssetSummary` (assets.openapi.yaml) — one inventory row; also the shape shared by `AssetDetail`. */
export interface AssetSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Server-truncated 200-character projection of the description, list previews only (never `description` itself, which appears only on `AssetDetail`). `null` when the asset has no description. */
  readonly descriptionExcerpt: string | null;
  /**
   * REQUIRED property, NULLABLE value — deliberately, per the contract's own
   * comment on this field. `null` only for an asset minted before this
   * module existed, whose minimal registry row never carried an
   * organizational unit (data-model.md §1/§6, research.md D-2). `NULL` is
   * invisible to any scope-by-unit caller — never an invented unit. Every
   * render site must treat this as an honest "not set", never crash on it.
   */
  readonly orgUnit: OrgUnitRef | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

/** Mirrors `AssetDetail` (assets.openapi.yaml) — `GET /assets/{assetId}`. No `version` field: see this file's own header comment. */
export interface AssetDetail extends AssetSummary {
  /** Stored intact regardless of length. `null` when none was recorded. */
  readonly description: string | null;
  readonly createdAt: string;
  /**
   * The risks this asset is CURRENTLY linked to (FR-008) — active
   * `RiskAssetLink`s only, read from the asset's own side. Read-only here
   * by design: created and withdrawn only from the Risk module's own
   * contract (`POST`/`DELETE /risks/{riskId}/assets`). A withdrawn link is
   * never included here.
   */
  readonly risks: readonly RiskRef[];
  /**
   * The controls this asset is CURRENTLY linked to (FR-008) — active
   * `ControlAssetLink`s only. Read-only here by design: created and
   * withdrawn only from the Control module's own contract (`POST`/`DELETE
   * /controls/{controlId}/assets`).
   */
  readonly controls: readonly ControlRef[];
}

/** Mirrors `CreateAssetRequest` — creates an active asset. `code` and `isActive` are server-owned and never expressible here (invariant A6). */
export interface CreateAssetRequest {
  name: string;
  description?: string;
  /** Required (invariant A1). Must lie inside the caller's authorized organizational scope, or refused with `422` (invariant A2). */
  orgUnitId: string;
}

/** Mirrors `UpdateAssetRequest` — partial; omitted properties are left unchanged server-side. `code` and `isActive` are read-only and rejected if supplied — situation changes only through `POST /assets/{assetId}/deactivate` and `.../reactivate`. */
export interface UpdateAssetRequest {
  name?: string;
  description?: string;
  /** Reassignment is refused with `422` if the target unit does not exist or lies outside the caller's authorized scope (invariant A2). */
  orgUnitId?: string;
}

/** Mirrors the query parameters of `GET /assets`. */
export interface AssetListQuery {
  page: number;
  pageSize: number;
  /** Case-insensitive text search across asset code and name. */
  q?: string;
  /** Always intersected with the caller's own authorized scope server-side — narrows the result, never widens it. */
  orgUnitId?: readonly string[];
  /** Omitted returns both active and inactive assets. */
  isActive?: boolean;
  sort?: AssetListSortField;
  direction?: SortDirection;
}

/** A page envelope, mirroring `PageMeta` (assets.openapi.yaml). */
export interface Page<T> {
  data: readonly T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 013-incidents-problems-reverse-links — READ-ONLY reverse of
 * `IncidentAssetLink` (`GET /assets/{assetId}/incidents`). `modules/assets`
 * never writes this table — `POST`/`DELETE /incidents/{incidentId}/assets`
 * on the Incident side owns that write path. `IncidentRef` is deliberately
 * minimal (id/code/title/status only, ADR-020 part 4) — never the full
 * `Incident` shape `incidents.openapi.yaml` declares.
 */
export type IncidentStatusRef = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface IncidentRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatusRef;
}

export interface LinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface AssetIncidentLink {
  readonly id: string;
  readonly incident: IncidentRef;
  readonly linkedBy: LinkUserRef;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}
