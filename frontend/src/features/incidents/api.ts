import { apiClient } from '@/lib/api-client';

import type {
  AssetRef,
  CreateIncidentRequest,
  IncidentAssetLinkResponse,
  IncidentDetail,
  IncidentListResponse,
  IncidentProblemLinkResponse,
  IncidentProcessLinkResponse,
  IncidentRegisterQuery,
  IncidentRiskLinkResponse,
  ProcessRef,
  RiskRef,
  TransitionIncidentRequest,
  UpdateIncidentRequest,
} from './types';
import type {
  Attachment,
  Comment,
  OrgUnitNode,
  Page,
  RegistrySearchResult,
  UserRef as RisksUserRef,
} from '@/features/risks/types';

function buildRegisterQueryString(query: IncidentRegisterQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.search) params.set('search', query.search);
  for (const status of query.status ?? []) params.append('status', status);
  for (const severity of query.severity ?? []) params.append('severity', severity);
  if (query.orgUnitId) params.set('orgUnitId', query.orgUnitId);
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);
  return params.toString();
}

export const incidentsApi = {
  listRegister(query: IncidentRegisterQuery): Promise<IncidentListResponse> {
    return apiClient.get<IncidentListResponse>(`/incidents?${buildRegisterQueryString(query)}`);
  },

  getById(incidentId: string): Promise<IncidentDetail> {
    return apiClient.get<IncidentDetail>(`/incidents/${incidentId}`);
  },

  create(body: CreateIncidentRequest): Promise<IncidentDetail> {
    return apiClient.post<IncidentDetail>('/incidents', body);
  },

  update(incidentId: string, body: UpdateIncidentRequest): Promise<IncidentDetail> {
    return apiClient.patch<IncidentDetail>(`/incidents/${incidentId}`, body);
  },

  transition(incidentId: string, body: TransitionIncidentRequest): Promise<IncidentDetail> {
    return apiClient.post<IncidentDetail>(`/incidents/${incidentId}/transitions`, body);
  },

  listRiskLinks(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentRiskLinkResponse[]> {
    return apiClient.get<readonly IncidentRiskLinkResponse[]>(
      `/incidents/${incidentId}/risks?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkRisk(incidentId: string, riskId: string): Promise<IncidentRiskLinkResponse> {
    return apiClient.post<IncidentRiskLinkResponse>(`/incidents/${incidentId}/risks`, { riskId });
  },

  unlinkRisk(incidentId: string, linkId: string): Promise<IncidentRiskLinkResponse> {
    return apiClient.delete<IncidentRiskLinkResponse>(`/incidents/${incidentId}/risks/${linkId}`);
  },

  listAssetLinks(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentAssetLinkResponse[]> {
    return apiClient.get<readonly IncidentAssetLinkResponse[]>(
      `/incidents/${incidentId}/assets?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkAsset(incidentId: string, assetId: string): Promise<IncidentAssetLinkResponse> {
    return apiClient.post<IncidentAssetLinkResponse>(`/incidents/${incidentId}/assets`, {
      assetId,
    });
  },

  unlinkAsset(incidentId: string, linkId: string): Promise<IncidentAssetLinkResponse> {
    return apiClient.delete<IncidentAssetLinkResponse>(`/incidents/${incidentId}/assets/${linkId}`);
  },

  listProcessLinks(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProcessLinkResponse[]> {
    return apiClient.get<readonly IncidentProcessLinkResponse[]>(
      `/incidents/${incidentId}/processes?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkProcess(incidentId: string, processId: string): Promise<IncidentProcessLinkResponse> {
    return apiClient.post<IncidentProcessLinkResponse>(`/incidents/${incidentId}/processes`, {
      processId,
    });
  },

  unlinkProcess(incidentId: string, linkId: string): Promise<IncidentProcessLinkResponse> {
    return apiClient.delete<IncidentProcessLinkResponse>(
      `/incidents/${incidentId}/processes/${linkId}`,
    );
  },

  listProblemLinks(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProblemLinkResponse[]> {
    return apiClient.get<readonly IncidentProblemLinkResponse[]>(
      `/incidents/${incidentId}/problems?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  listOrgUnits(): Promise<OrgUnitNode[]> {
    return apiClient.get<OrgUnitNode[]>('/org-units');
  },

  async searchUsers(q: string): Promise<{ data: RisksUserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<RisksUserRef>>(`/users?${params.toString()}`);
    return { data: [...page.data], isPartial: page.data.length < page.meta.total };
  },

  async listRiskOptions(q: string): Promise<RegistrySearchResult<RiskRef>> {
    const page = await apiClient.get<Page<RiskRef>>(
      `/risks?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  async listAssetOptions(q: string): Promise<RegistrySearchResult<AssetRef>> {
    const page = await apiClient.get<Page<AssetRef>>(
      `/assets?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  async listProcessOptions(q: string): Promise<RegistrySearchResult<ProcessRef>> {
    const page = await apiClient.get<Page<ProcessRef>>(
      `/processes?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  listComments(incidentId: string, page: number, pageSize: number): Promise<Page<Comment>> {
    return apiClient.get<Page<Comment>>(
      `/comments?entityType=INCIDENT&entityId=${incidentId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  createComment(incidentId: string, body: string): Promise<Comment> {
    return apiClient.post<Comment>('/comments', {
      entityType: 'INCIDENT',
      entityId: incidentId,
      body,
    });
  },

  withdrawComment(commentId: string): Promise<void> {
    return apiClient.delete<void>(`/comments/${commentId}`);
  },

  listAttachments(incidentId: string, page: number, pageSize: number): Promise<Page<Attachment>> {
    return apiClient.get<Page<Attachment>>(
      `/attachments?entityType=INCIDENT&entityId=${incidentId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  async uploadAttachment(incidentId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.set('entityType', 'INCIDENT');
    formData.set('entityId', incidentId);
    formData.set('file', file);
    const { data } = await apiClient.postFormWithMeta<Attachment>('/attachments', formData);
    return data;
  },

  withdrawAttachment(attachmentId: string): Promise<void> {
    return apiClient.delete<void>(`/attachments/${attachmentId}`);
  },
};
