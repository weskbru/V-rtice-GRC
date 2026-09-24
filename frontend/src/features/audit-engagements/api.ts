import { apiClient } from '@/lib/api-client';

import type {
  AddControlScopeRequest,
  AddFrameworkVersionScopeRequest,
  AddRequirementScopeRequest,
  AuditEngagement,
  AuditEngagementFindingsQuery,
  AuditEngagementListQuery,
  AuditScopeEntry,
  CancelAuditEngagementRequest,
  ControlRef,
  CreateAuditEngagementRequest,
  CreateFindingFromEngagementRequest,
  FindingSummary,
  FrameworkRef,
  FrameworkVersionOption,
  OrgUnitNode,
  Page,
  RegistrySearchResult,
  RequirementOption,
  UpdateAuditEngagementRequest,
  UserRef,
} from './types';

export interface AuditEngagementWithEtag {
  engagement: AuditEngagement;
  etag: string;
}

function resolveEtag(etag: string | null, version: number): string {
  return etag ?? `"${version}"`;
}

function buildEngagementListQueryString(query: AuditEngagementListQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  if (query.orgUnitId) params.set('orgUnitId', query.orgUnitId);
  if (query.leadAuditorUserId) params.set('leadAuditorUserId', query.leadAuditorUserId);
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);
  return params.toString();
}

function buildEngagementFindingsQueryString(query: AuditEngagementFindingsQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  return params.toString();
}

export const auditEngagementsApi = {
  listEngagements(query: AuditEngagementListQuery): Promise<Page<AuditEngagement>> {
    return apiClient.get<Page<AuditEngagement>>(`/audits?${buildEngagementListQueryString(query)}`);
  },

  async getEngagement(auditId: string): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.getWithMeta<AuditEngagement>(`/audits/${auditId}`);
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  async createEngagement(body: CreateAuditEngagementRequest): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.postWithMeta<AuditEngagement>('/audits', body);
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  async updateEngagement(
    auditId: string,
    body: UpdateAuditEngagementRequest,
    ifMatch: string,
  ): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.patchWithMeta<AuditEngagement>(
      `/audits/${auditId}`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  listScope(auditId: string): Promise<readonly AuditScopeEntry[]> {
    return apiClient.get<readonly AuditScopeEntry[]>(`/audits/${auditId}/scope`);
  },

  addFrameworkVersionToScope(
    auditId: string,
    body: AddFrameworkVersionScopeRequest,
  ): Promise<AuditScopeEntry> {
    return apiClient.post<AuditScopeEntry>(`/audits/${auditId}/scope/framework-versions`, body);
  },

  addRequirementToScope(
    auditId: string,
    body: AddRequirementScopeRequest,
  ): Promise<AuditScopeEntry> {
    return apiClient.post<AuditScopeEntry>(`/audits/${auditId}/scope/requirements`, body);
  },

  addControlToScope(auditId: string, body: AddControlScopeRequest): Promise<AuditScopeEntry> {
    return apiClient.post<AuditScopeEntry>(`/audits/${auditId}/scope/controls`, body);
  },

  async startEngagement(auditId: string, ifMatch: string): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.postWithMeta<AuditEngagement>(
      `/audits/${auditId}/start`,
      undefined,
      { headers: { 'If-Match': ifMatch } },
    );
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  async completeEngagement(auditId: string, ifMatch: string): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.postWithMeta<AuditEngagement>(
      `/audits/${auditId}/complete`,
      undefined,
      { headers: { 'If-Match': ifMatch } },
    );
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  async cancelEngagement(
    auditId: string,
    body: CancelAuditEngagementRequest,
    ifMatch: string,
  ): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.postWithMeta<AuditEngagement>(
      `/audits/${auditId}/cancel`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  listEngagementFindings(
    auditId: string,
    query: AuditEngagementFindingsQuery,
  ): Promise<Page<FindingSummary>> {
    return apiClient.get<Page<FindingSummary>>(
      `/audits/${auditId}/findings?${buildEngagementFindingsQueryString(query)}`,
    );
  },

  createEngagementFinding(
    auditId: string,
    body: CreateFindingFromEngagementRequest,
  ): Promise<FindingSummary> {
    return apiClient.post<FindingSummary>(`/audits/${auditId}/findings`, body);
  },

  listOrgUnits(): Promise<OrgUnitNode[]> {
    return apiClient.get<OrgUnitNode[]>('/org-units');
  },

  async searchUsers(q: string): Promise<{ data: readonly UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  async listFrameworks(): Promise<readonly FrameworkRef[]> {
    const page = await apiClient.get<Page<FrameworkRef>>('/frameworks?pageSize=100');
    return page.data;
  },

  async listPublishedFrameworkVersions(
    frameworkId: string,
  ): Promise<readonly FrameworkVersionOption[]> {
    const page = await apiClient.get<Page<FrameworkVersionOption>>(
      `/frameworks/${frameworkId}/versions?status=PUBLISHED&pageSize=100`,
    );
    return page.data;
  },

  async listRequirements(
    frameworkId: string,
    versionId: string,
  ): Promise<readonly RequirementOption[]> {
    const page = await apiClient.get<Page<RequirementOption>>(
      `/frameworks/${frameworkId}/versions/${versionId}/requirements?pageSize=100`,
    );
    return page.data;
  },

  async listControls(q: string): Promise<RegistrySearchResult<ControlRef>> {
    const page = await apiClient.get<Page<ControlRef>>(
      `/controls?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },
};
