/**
 * PharosGRC frontend — Asset Management API wrapper (T044, 006-assets-processes).
 *
 * A thin, typed layer over `apiClient` for the six operations of
 * `specs/006-assets-processes/contracts/assets.openapi.yaml`, mirroring
 * `features/controls/api.ts`'s/`features/audit-engagements/api.ts`'s own
 * conventions.
 *
 * **No `If-Match`, anywhere in this file.** Unlike `controlsApi`'s/
 * `auditEngagementsApi`'s versioned mutations, none of the six operations
 * below reads or writes an entity-tag: `PATCH /assets/{assetId}` and the two
 * lifecycle transitions apply last-write-wins directly to the row, by this
 * contract's own deliberate design (see `./types.ts`'s header comment for
 * why). Every call here uses the plain `apiClient.get`/`post`/`patch`
 * methods — never the `...WithMeta` variants those two other clients need.
 */
import { apiClient } from '@/lib/api-client';

import type {
  AssetDetail,
  AssetIncidentLink,
  AssetListQuery,
  AssetSummary,
  CreateAssetRequest,
  OrgUnitNode,
  Page,
  UpdateAssetRequest,
} from './types';

/** Builds `GET /assets`'s query string exactly per its contract: comma-separated arrays (`style: form, explode: false`), omitting any filter the caller did not set. */
function buildListQueryString(query: AssetListQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.orgUnitId && query.orgUnitId.length > 0) {
    params.set('orgUnitId', query.orgUnitId.join(','));
  }
  if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);
  return params.toString();
}

export const assetsApi = {
  /** `GET /assets` (`listAssetCatalog`) — the asset inventory, restricted to the caller's authorized organizational scope (FR-009, FR-010). Always paginated; never fetches more than one page. */
  listCatalog(query: AssetListQuery): Promise<Page<AssetSummary>> {
    return apiClient.get<Page<AssetSummary>>(`/assets?${buildListQueryString(query)}`);
  },

  /** `GET /assets/{assetId}` — includes the risks and controls this asset is currently linked to (FR-008). A caller outside the asset's organizational scope receives the same `404` as a nonexistent id (non-disclosure). */
  getAsset(assetId: string): Promise<AssetDetail> {
    return apiClient.get<AssetDetail>(`/assets/${assetId}`);
  },

  /** `POST /assets` — `orgUnitId` is required (invariant A1) and must lie inside the caller's scope. The server assigns the `AST-` prefixed `code`; the created asset is always active. */
  createAsset(body: CreateAssetRequest): Promise<AssetDetail> {
    return apiClient.post<AssetDetail>('/assets', body);
  },

  /** `PATCH /assets/{assetId}` — partial update of descriptive data. No `If-Match`: see this file's own header comment. */
  updateAsset(assetId: string, body: UpdateAssetRequest): Promise<AssetDetail> {
    return apiClient.patch<AssetDetail>(`/assets/${assetId}`, body);
  },

  /** `POST /assets/{assetId}/deactivate` — no request body. The asset stays fully readable and stays visible in every link it already has; only new links are refused from this point on (FR-006). Refused with `422` if already inactive. */
  deactivateAsset(assetId: string): Promise<AssetDetail> {
    return apiClient.post<AssetDetail>(`/assets/${assetId}/deactivate`);
  },

  /** `POST /assets/{assetId}/reactivate` — no request body. Refused with `422` if already active. */
  reactivateAsset(assetId: string): Promise<AssetDetail> {
    return apiClient.post<AssetDetail>(`/assets/${assetId}/reactivate`);
  },

  /**
   * 013-incidents-problems-reverse-links — `GET /assets/{assetId}/incidents`,
   * READ-ONLY: `modules/assets` never writes `IncidentAssetLink` — the
   * Incident side owns that write path.
   */
  listIncidentLinks(
    assetId: string,
    includeWithdrawn = false,
  ): Promise<readonly AssetIncidentLink[]> {
    return apiClient.get<readonly AssetIncidentLink[]>(
      `/assets/${assetId}/incidents?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  // -------------------------------------------------------------------
  // Reference data
  // -------------------------------------------------------------------

  /** `GET /org-units` — already restricted to the caller's authorized scope by the server; the create/edit form's organizational unit picker. */
  listOrgUnits(): Promise<OrgUnitNode[]> {
    return apiClient.get<OrgUnitNode[]>('/org-units');
  },
};
