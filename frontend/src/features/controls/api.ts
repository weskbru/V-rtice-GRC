import { apiClient } from '@/lib/api-client';

import type {
  ControlAssessment,
  ControlAssessmentAttestation,
  ControlAssessmentAttestationDecisionRequest,
  ControlAssetLink,
  ControlDetail,
  ControlLifecycleState,
  ControlLifecycleTransition,
  ControlProcessLink,
  ControlRegisterQuery,
  ControlRiskLink,
  ControlSummary,
  CreateControlAssessmentRequest,
  CreateControlRequest,
  LinkEntityRequest,
  OrgUnitNode,
  Page,
  RegistryItem,
  RegistrySearchResult,
  TransitionControlRequest,
  UpdateControlRequest,
  UserRef,
} from './types';
import type { Action, ActionOriginType } from '@/features/actions/types';

export interface ControlWithVersion {
  control: ControlDetail;
  etag: string;
}

function resolveEtag(etag: string | null, version: number): string {
  return etag ?? `"${version}"`;
}

function buildRegisterQueryString(query: ControlRegisterQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.status && query.status.length > 0) params.set('status', query.status.join(','));
  if (query.effectiveness && query.effectiveness.length > 0)
    params.set('effectiveness', query.effectiveness.join(','));
  if (query.nature && query.nature.length > 0) params.set('nature', query.nature.join(','));
  if (query.type && query.type.length > 0) params.set('type', query.type.join(','));
  if (query.frequency && query.frequency.length > 0)
    params.set('frequency', query.frequency.join(','));
  if (query.orgUnitId && query.orgUnitId.length > 0)
    params.set('orgUnitId', query.orgUnitId.join(','));
  if (query.ownerUserId && query.ownerUserId.length > 0)
    params.set('ownerUserId', query.ownerUserId.join(','));
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);
  return params.toString();
}

export const controlsApi = {
  listCatalog(query: ControlRegisterQuery): Promise<Page<ControlSummary>> {
    return apiClient.get<Page<ControlSummary>>(`/controls?${buildRegisterQueryString(query)}`);
  },

  async getControl(controlId: string): Promise<ControlWithVersion> {
    const { data, etag } = await apiClient.getWithMeta<ControlDetail>(`/controls/${controlId}`);
    return { control: data, etag: resolveEtag(etag, data.version) };
  },

  async createControl(body: CreateControlRequest): Promise<ControlWithVersion> {
    const { data, etag } = await apiClient.postWithMeta<ControlDetail>('/controls', body);
    return { control: data, etag: resolveEtag(etag, data.version) };
  },

  async updateControl(
    controlId: string,
    body: UpdateControlRequest,
    ifMatch: string,
  ): Promise<ControlWithVersion> {
    const { data, etag } = await apiClient.patchWithMeta<ControlDetail>(
      `/controls/${controlId}`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { control: data, etag: resolveEtag(etag, data.version) };
  },

  getLifecycle(controlId: string): Promise<ControlLifecycleState> {
    return apiClient.get<ControlLifecycleState>(`/controls/${controlId}/lifecycle`);
  },

  async transitionControl(
    controlId: string,
    body: TransitionControlRequest,
    ifMatch: string,
  ): Promise<{ transition: ControlLifecycleTransition; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<ControlLifecycleTransition>(
      `/controls/${controlId}/transitions`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { transition: data, etag: etag ?? ifMatch };
  },

  listAssessments(
    controlId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<ControlAssessment>> {
    return apiClient.get<Page<ControlAssessment>>(
      `/controls/${controlId}/assessments?page=${page}&pageSize=${pageSize}`,
    );
  },

  createAssessment(
    controlId: string,
    body: CreateControlAssessmentRequest,
  ): Promise<ControlAssessment> {
    return apiClient.post<ControlAssessment>(`/controls/${controlId}/assessments`, body);
  },

  requestAttestation(
    controlId: string,
    assessmentId: string,
  ): Promise<ControlAssessmentAttestation> {
    return apiClient.post<ControlAssessmentAttestation>(
      `/controls/${controlId}/assessments/${assessmentId}/attestation`,
    );
  },

  decideAttestation(
    controlId: string,
    assessmentId: string,
    body: ControlAssessmentAttestationDecisionRequest,
  ): Promise<ControlAssessmentAttestation> {
    return apiClient.post<ControlAssessmentAttestation>(
      `/controls/${controlId}/assessments/${assessmentId}/attestation/decision`,
      body,
    );
  },

  listRiskLinks(controlId: string, includeWithdrawn = false): Promise<readonly ControlRiskLink[]> {
    return apiClient.get<readonly ControlRiskLink[]>(
      `/controls/${controlId}/risks?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  listProcessLinks(
    controlId: string,
    includeWithdrawn = false,
  ): Promise<readonly ControlProcessLink[]> {
    return apiClient.get<readonly ControlProcessLink[]>(
      `/controls/${controlId}/processes?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkProcess(controlId: string, body: LinkEntityRequest): Promise<ControlProcessLink> {
    return apiClient.post<ControlProcessLink>(`/controls/${controlId}/processes`, body);
  },

  unlinkProcess(controlId: string, linkId: string): Promise<void> {
    return apiClient.delete<void>(`/controls/${controlId}/processes/${linkId}`);
  },

  listAssetLinks(
    controlId: string,
    includeWithdrawn = false,
  ): Promise<readonly ControlAssetLink[]> {
    return apiClient.get<readonly ControlAssetLink[]>(
      `/controls/${controlId}/assets?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkAsset(controlId: string, body: LinkEntityRequest): Promise<ControlAssetLink> {
    return apiClient.post<ControlAssetLink>(`/controls/${controlId}/assets`, body);
  },

  unlinkAsset(controlId: string, linkId: string): Promise<void> {
    return apiClient.delete<void>(`/controls/${controlId}/assets/${linkId}`);
  },

  listOrgUnits: (): Promise<OrgUnitNode[]> => apiClient.get<OrgUnitNode[]>('/org-units'),

  async listProcesses(q: string): Promise<RegistrySearchResult<RegistryItem>> {
    const page = await apiClient.get<Page<RegistryItem>>(
      `/processes?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  async listAssets(q: string): Promise<RegistrySearchResult<RegistryItem>> {
    const page = await apiClient.get<Page<RegistryItem>>(
      `/assets?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  async searchUsers(
    q: string,
    assignableForOrgUnitId?: string,
  ): Promise<{ data: UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    if (assignableForOrgUnitId) {
      params.set('assignableForOrgUnitId', assignableForOrgUnitId);
    }
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: [...page.data], isPartial: page.data.length < page.meta.total };
  },

  async listAssessmentActions(assessmentId: string): Promise<readonly Action[]> {
    const page = await apiClient.get<{ items: readonly Action[] }>(
      `/actions?page=1&pageSize=25&originType=CONTROL_ASSESSMENT&originId=${assessmentId}`,
    );
    return page.items;
  },

  createAssessmentAction(
    assessmentId: string,
    body: { title: string; description?: string; responsibleUserId: string; dueOn: string },
  ): Promise<Action> {
    const originType: ActionOriginType = 'CONTROL_ASSESSMENT';
    return apiClient.post<Action>('/actions', { ...body, originType, originId: assessmentId });
  },
};
