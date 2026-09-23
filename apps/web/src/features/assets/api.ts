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
  listCatalog(query: AssetListQuery): Promise<Page<AssetSummary>> {
    return apiClient.get<Page<AssetSummary>>(`/assets?${buildListQueryString(query)}`);
  },

  getAsset(assetId: string): Promise<AssetDetail> {
    return apiClient.get<AssetDetail>(`/assets/${assetId}`);
  },

  createAsset(body: CreateAssetRequest): Promise<AssetDetail> {
    return apiClient.post<AssetDetail>('/assets', body);
  },

  updateAsset(assetId: string, body: UpdateAssetRequest): Promise<AssetDetail> {
    return apiClient.patch<AssetDetail>(`/assets/${assetId}`, body);
  },

  deactivateAsset(assetId: string): Promise<AssetDetail> {
    return apiClient.post<AssetDetail>(`/assets/${assetId}/deactivate`);
  },

  reactivateAsset(assetId: string): Promise<AssetDetail> {
    return apiClient.post<AssetDetail>(`/assets/${assetId}/reactivate`);
  },

  listIncidentLinks(
    assetId: string,
    includeWithdrawn = false,
  ): Promise<readonly AssetIncidentLink[]> {
    return apiClient.get<readonly AssetIncidentLink[]>(
      `/assets/${assetId}/incidents?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  listOrgUnits(): Promise<OrgUnitNode[]> {
    return apiClient.get<OrgUnitNode[]>('/org-units');
  },
};
