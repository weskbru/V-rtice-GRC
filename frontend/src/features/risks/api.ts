import { apiClient } from '@/lib/api-client';

import type {
  Approval,
  ApprovalDecisionRequest,
  Attachment,
  AuditEvent,
  Comment,
  CreateRiskAssessmentRequest,
  CreateRiskRequest,
  CreateRiskTreatmentActionRequest,
  CreateRiskTreatmentDecisionRequest,
  LinkEntityRequest,
  OrgUnitNode,
  Page,
  ReferenceDataItem,
  RegistryItem,
  RegistrySearchResult,
  RequestApprovalRequest,
  RiskAssessment,
  RiskControlLink,
  RiskDetail,
  RiskEntityLink,
  RiskHistoryEntry,
  RiskHistoryEntryType,
  RiskIncidentLink,
  RiskLifecycleState,
  RiskLifecycleTransition,
  RiskMethodologyVersion,
  RiskProblemLink,
  RiskRegisterQuery,
  RiskStatement,
  RiskSummary,
  RiskTreatmentAction,
  RiskTreatmentDecision,
  TransitionRiskRequest,
  TreatmentActionStatus,
  UpdateRiskRequest,
  UpdateRiskTreatmentActionRequest,
  UserRef,
} from './types';

export interface RiskWithVersion {
  risk: RiskDetail;
  etag: string;
}

function resolveEtag(etag: string | null, version: number): string {
  return etag ?? `"${version}"`;
}

function buildRegisterQueryString(query: RiskRegisterQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.status && query.status.length > 0) params.set('status', query.status.join(','));
  if (query.riskLevel && query.riskLevel.length > 0)
    params.set('riskLevel', query.riskLevel.join(','));
  if (query.riskLevelBasis) params.set('riskLevelBasis', query.riskLevelBasis);
  if (query.categoryId && query.categoryId.length > 0)
    params.set('categoryId', query.categoryId.join(','));
  if (query.orgUnitId && query.orgUnitId.length > 0)
    params.set('orgUnitId', query.orgUnitId.join(','));
  if (query.includeDescendants !== undefined)
    params.set('includeDescendants', String(query.includeDescendants));
  if (query.ownerUserId && query.ownerUserId.length > 0)
    params.set('ownerUserId', query.ownerUserId.join(','));
  if (query.overdueReview !== undefined) params.set('overdueReview', String(query.overdueReview));
  if (query.overdueTreatment !== undefined)
    params.set('overdueTreatment', String(query.overdueTreatment));
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);
  return params.toString();
}

export const risksApi = {
  listRegister(query: RiskRegisterQuery): Promise<Page<RiskSummary>> {
    return apiClient.get<Page<RiskSummary>>(`/risks?${buildRegisterQueryString(query)}`);
  },

  async getRisk(riskId: string): Promise<RiskWithVersion> {
    const { data, etag } = await apiClient.getWithMeta<RiskDetail>(`/risks/${riskId}`);
    return { risk: data, etag: resolveEtag(etag, data.version) };
  },

  async createRisk(body: CreateRiskRequest): Promise<RiskWithVersion> {
    const { data, etag } = await apiClient.postWithMeta<RiskDetail>('/risks', body);
    return { risk: data, etag: resolveEtag(etag, data.version) };
  },

  async updateRisk(
    riskId: string,
    body: UpdateRiskRequest,
    ifMatch: string,
  ): Promise<RiskWithVersion> {
    const { data, etag } = await apiClient.patchWithMeta<RiskDetail>(`/risks/${riskId}`, body, {
      headers: { 'If-Match': ifMatch },
    });
    return { risk: data, etag: resolveEtag(etag, data.version) };
  },

  async replaceCauses(
    riskId: string,
    items: readonly string[],
    ifMatch: string,
  ): Promise<{ items: readonly RiskStatement[]; etag: string }> {
    const { data, etag } = await apiClient.putWithMeta<RiskStatement[]>(
      `/risks/${riskId}/causes`,
      { items },
      { headers: { 'If-Match': ifMatch } },
    );
    return { items: data, etag: etag ?? ifMatch };
  },

  async replaceConsequences(
    riskId: string,
    items: readonly string[],
    ifMatch: string,
  ): Promise<{ items: readonly RiskStatement[]; etag: string }> {
    const { data, etag } = await apiClient.putWithMeta<RiskStatement[]>(
      `/risks/${riskId}/consequences`,
      { items },
      { headers: { 'If-Match': ifMatch } },
    );
    return { items: data, etag: etag ?? ifMatch };
  },

  getActiveMethodology(): Promise<RiskMethodologyVersion> {
    return apiClient.get<RiskMethodologyVersion>('/risk-methodology');
  },

  listAssessments(riskId: string, page: number, pageSize: number): Promise<Page<RiskAssessment>> {
    return apiClient.get<Page<RiskAssessment>>(
      `/risks/${riskId}/assessments?page=${page}&pageSize=${pageSize}`,
    );
  },

  async createAssessment(
    riskId: string,
    body: CreateRiskAssessmentRequest,
    ifMatch: string,
  ): Promise<{ assessment: RiskAssessment; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskAssessment>(
      `/risks/${riskId}/assessments`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { assessment: data, etag: etag ?? ifMatch };
  },

  listCategories: (): Promise<ReferenceDataItem[]> =>
    apiClient.get<ReferenceDataItem[]>('/risk-categories'),
  listTypes: (): Promise<ReferenceDataItem[]> => apiClient.get<ReferenceDataItem[]>('/risk-types'),
  listOrigins: (): Promise<ReferenceDataItem[]> =>
    apiClient.get<ReferenceDataItem[]>('/risk-origins'),

  listOrgUnits: (): Promise<OrgUnitNode[]> => apiClient.get<OrgUnitNode[]>('/org-units'),

  listTreatments(
    riskId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<RiskTreatmentDecision>> {
    return apiClient.get<Page<RiskTreatmentDecision>>(
      `/risks/${riskId}/treatments?page=${page}&pageSize=${pageSize}`,
    );
  },

  async createTreatment(
    riskId: string,
    body: CreateRiskTreatmentDecisionRequest,
    ifMatch: string,
  ): Promise<{ decision: RiskTreatmentDecision; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskTreatmentDecision>(
      `/risks/${riskId}/treatments`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { decision: data, etag: etag ?? ifMatch };
  },

  listTreatmentActions(
    riskId: string,
    page: number,
    pageSize: number,
    filters?: { status?: readonly TreatmentActionStatus[]; overdue?: boolean },
  ): Promise<Page<RiskTreatmentAction>> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (filters?.status && filters.status.length > 0) {
      params.set('status', filters.status.join(','));
    }
    if (filters?.overdue !== undefined) {
      params.set('overdue', String(filters.overdue));
    }
    return apiClient.get<Page<RiskTreatmentAction>>(
      `/risks/${riskId}/treatment-actions?${params.toString()}`,
    );
  },

  async createTreatmentAction(
    riskId: string,
    body: CreateRiskTreatmentActionRequest,
    ifMatch: string,
  ): Promise<{ action: RiskTreatmentAction; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskTreatmentAction>(
      `/risks/${riskId}/treatment-actions`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { action: data, etag: etag ?? ifMatch };
  },

  async updateTreatmentAction(
    riskId: string,
    actionId: string,
    body: UpdateRiskTreatmentActionRequest,
    ifMatch: string,
  ): Promise<{ action: RiskTreatmentAction; etag: string }> {
    const { data, etag } = await apiClient.patchWithMeta<RiskTreatmentAction>(
      `/risks/${riskId}/treatment-actions/${actionId}`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { action: data, etag: etag ?? ifMatch };
  },

  listControlLinks(riskId: string, includeWithdrawn = false): Promise<readonly RiskControlLink[]> {
    return apiClient.get<readonly RiskControlLink[]>(
      `/risks/${riskId}/controls?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  listIncidentLinks(
    riskId: string,
    includeWithdrawn = false,
  ): Promise<readonly RiskIncidentLink[]> {
    return apiClient.get<readonly RiskIncidentLink[]>(
      `/risks/${riskId}/incidents?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  listProblemLinks(riskId: string, includeWithdrawn = false): Promise<readonly RiskProblemLink[]> {
    return apiClient.get<readonly RiskProblemLink[]>(
      `/risks/${riskId}/problems?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  async linkControl(
    riskId: string,
    body: LinkEntityRequest,
    ifMatch: string,
  ): Promise<{ link: RiskControlLink; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskControlLink>(
      `/risks/${riskId}/controls`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { link: data, etag: etag ?? ifMatch };
  },

  async unlinkControl(riskId: string, linkId: string, ifMatch: string): Promise<{ etag: string }> {
    const { etag } = await apiClient.deleteWithMeta<void>(`/risks/${riskId}/controls/${linkId}`, {
      headers: { 'If-Match': ifMatch },
    });
    return { etag: etag ?? ifMatch };
  },

  async linkProcess(
    riskId: string,
    body: LinkEntityRequest,
    ifMatch: string,
  ): Promise<{ link: RiskEntityLink; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskEntityLink>(
      `/risks/${riskId}/processes`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { link: data, etag: etag ?? ifMatch };
  },

  async unlinkProcess(riskId: string, linkId: string, ifMatch: string): Promise<{ etag: string }> {
    const { etag } = await apiClient.deleteWithMeta<void>(`/risks/${riskId}/processes/${linkId}`, {
      headers: { 'If-Match': ifMatch },
    });
    return { etag: etag ?? ifMatch };
  },

  async linkAsset(
    riskId: string,
    body: LinkEntityRequest,
    ifMatch: string,
  ): Promise<{ link: RiskEntityLink; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskEntityLink>(
      `/risks/${riskId}/assets`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { link: data, etag: etag ?? ifMatch };
  },

  async unlinkAsset(riskId: string, linkId: string, ifMatch: string): Promise<{ etag: string }> {
    const { etag } = await apiClient.deleteWithMeta<void>(`/risks/${riskId}/assets/${linkId}`, {
      headers: { 'If-Match': ifMatch },
    });
    return { etag: etag ?? ifMatch };
  },

  async listControls(q: string): Promise<RegistrySearchResult<RegistryItem>> {
    const page = await apiClient.get<Page<RegistryItem>>(
      `/controls?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

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
    pageSize = 20,
  ): Promise<{ data: UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: String(pageSize) });
    if (q) params.set('q', q);
    if (assignableForOrgUnitId) {
      params.set('assignableForOrgUnitId', assignableForOrgUnitId);
    }
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: [...page.data], isPartial: page.data.length < page.meta.total };
  },

  getLifecycle(riskId: string): Promise<RiskLifecycleState> {
    return apiClient.get<RiskLifecycleState>(`/risks/${riskId}/lifecycle`);
  },

  async transitionRisk(
    riskId: string,
    body: TransitionRiskRequest,
    ifMatch: string,
  ): Promise<{ transition: RiskLifecycleTransition; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskLifecycleTransition>(
      `/risks/${riskId}/transitions`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { transition: data, etag: etag ?? ifMatch };
  },

  async requestApproval(
    riskId: string,
    body: RequestApprovalRequest,
    ifMatch: string,
  ): Promise<{ approval: Approval; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<Approval>(
      `/risks/${riskId}/approvals`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { approval: data, etag: etag ?? ifMatch };
  },

  async decideApproval(
    riskId: string,
    approvalId: string,
    body: ApprovalDecisionRequest,
    ifMatch: string,
  ): Promise<{ approval: Approval; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<Approval>(
      `/risks/${riskId}/approvals/${approvalId}/decision`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { approval: data, etag: etag ?? ifMatch };
  },

  listHistory(
    riskId: string,
    page: number,
    pageSize: number,
    types?: readonly RiskHistoryEntryType[],
  ): Promise<Page<RiskHistoryEntry>> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (types && types.length > 0) {
      params.set('type', types.join(','));
    }
    return apiClient.get<Page<RiskHistoryEntry>>(`/risks/${riskId}/history?${params.toString()}`);
  },

  listAuditEvents(riskId: string, page: number, pageSize: number): Promise<Page<AuditEvent>> {
    return apiClient.get<Page<AuditEvent>>(
      `/risks/${riskId}/audit-events?page=${page}&pageSize=${pageSize}`,
    );
  },

  listComments(riskId: string, page: number, pageSize: number): Promise<Page<Comment>> {
    return apiClient.get<Page<Comment>>(
      `/comments?entityType=RISK&entityId=${riskId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  createComment(riskId: string, body: string): Promise<Comment> {
    return apiClient.post<Comment>('/comments', { entityType: 'RISK', entityId: riskId, body });
  },

  withdrawComment(commentId: string): Promise<void> {
    return apiClient.delete<void>(`/comments/${commentId}`);
  },

  listAttachments(riskId: string, page: number, pageSize: number): Promise<Page<Attachment>> {
    return apiClient.get<Page<Attachment>>(
      `/attachments?entityType=RISK&entityId=${riskId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  async uploadAttachment(riskId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.set('entityType', 'RISK');
    formData.set('entityId', riskId);
    formData.set('file', file);
    const { data } = await apiClient.postFormWithMeta<Attachment>('/attachments', formData);
    return data;
  },

  withdrawAttachment(attachmentId: string): Promise<void> {
    return apiClient.delete<void>(`/attachments/${attachmentId}`);
  },
};
