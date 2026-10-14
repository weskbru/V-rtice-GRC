import { apiClient } from '@/lib/api-client';

import type {
  CreateProblemRequest,
  ProblemDetail,
  ProblemIncidentLinkResponse,
  ProblemListResponse,
  ProblemRegisterQuery,
  ProblemRiskLinkResponse,
  TransitionProblemRequest,
  UpdateProblemRequest,
} from './types';
import type {
  Attachment,
  Comment,
  OrgUnitNode,
  Page,
  RegistrySearchResult,
  UserRef as RisksUserRef,
} from '@/features/risks/types';

interface ActionExistencePage {
  readonly total: number;
}

export interface RiskSearchOption {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface IncidentSearchOption {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

function buildRegisterQueryString(query: ProblemRegisterQuery): string {
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

export const problemsApi = {
  listRegister(query: ProblemRegisterQuery): Promise<ProblemListResponse> {
    return apiClient.get<ProblemListResponse>(`/problems?${buildRegisterQueryString(query)}`);
  },

  getById(problemId: string): Promise<ProblemDetail> {
    return apiClient.get<ProblemDetail>(`/problems/${problemId}`);
  },

  create(body: CreateProblemRequest): Promise<ProblemDetail> {
    return apiClient.post<ProblemDetail>('/problems', body);
  },

  update(problemId: string, body: UpdateProblemRequest): Promise<ProblemDetail> {
    return apiClient.patch<ProblemDetail>(`/problems/${problemId}`, body);
  },

  transition(problemId: string, body: TransitionProblemRequest): Promise<ProblemDetail> {
    return apiClient.post<ProblemDetail>(`/problems/${problemId}/transitions`, body);
  },

  listRiskLinks(
    problemId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemRiskLinkResponse[]> {
    return apiClient.get<readonly ProblemRiskLinkResponse[]>(
      `/problems/${problemId}/risks?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkRisk(problemId: string, riskId: string): Promise<ProblemRiskLinkResponse> {
    return apiClient.post<ProblemRiskLinkResponse>(`/problems/${problemId}/risks`, { riskId });
  },

  unlinkRisk(problemId: string, linkId: string): Promise<ProblemRiskLinkResponse> {
    return apiClient.delete<ProblemRiskLinkResponse>(`/problems/${problemId}/risks/${linkId}`);
  },

  listIncidentLinks(
    problemId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemIncidentLinkResponse[]> {
    return apiClient.get<readonly ProblemIncidentLinkResponse[]>(
      `/problems/${problemId}/incidents?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkToIncident(problemId: string, incidentId: string): Promise<ProblemIncidentLinkResponse> {
    return apiClient.post<ProblemIncidentLinkResponse>(`/problems/${problemId}/incidents`, {
      incidentId,
    });
  },

  unlinkFromIncident(problemId: string, linkId: string): Promise<ProblemIncidentLinkResponse> {
    return apiClient.delete<ProblemIncidentLinkResponse>(
      `/problems/${problemId}/incidents/${linkId}`,
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

  async listRiskOptions(q: string): Promise<RegistrySearchResult<RiskSearchOption>> {
    const page = await apiClient.get<Page<RiskSearchOption>>(
      `/risks?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  async listIncidentOptions(q: string): Promise<RegistrySearchResult<IncidentSearchOption>> {
    const page = await apiClient.get<Page<IncidentSearchOption>>(
      `/incidents?pageSize=25${q ? `&search=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: [...page.data], isPartial: page.data.length < page.meta.total };
  },

  async hasCompletedCorrectiveAction(problemId: string): Promise<boolean> {
    const page = await apiClient.get<ActionExistencePage>(
      `/actions?originType=PROBLEM&originId=${problemId}&status=COMPLETED&page=1&pageSize=1`,
    );
    return page.total > 0;
  },

  listComments(problemId: string, page: number, pageSize: number): Promise<Page<Comment>> {
    return apiClient.get<Page<Comment>>(
      `/comments?entityType=PROBLEM&entityId=${problemId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  createComment(problemId: string, body: string): Promise<Comment> {
    return apiClient.post<Comment>('/comments', {
      entityType: 'PROBLEM',
      entityId: problemId,
      body,
    });
  },

  withdrawComment(commentId: string): Promise<void> {
    return apiClient.delete<void>(`/comments/${commentId}`);
  },

  listAttachments(problemId: string, page: number, pageSize: number): Promise<Page<Attachment>> {
    return apiClient.get<Page<Attachment>>(
      `/attachments?entityType=PROBLEM&entityId=${problemId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  async uploadAttachment(problemId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.set('entityType', 'PROBLEM');
    formData.set('entityId', problemId);
    formData.set('file', file);
    const { data } = await apiClient.postFormWithMeta<Attachment>('/attachments', formData);
    return data;
  },

  withdrawAttachment(attachmentId: string): Promise<void> {
    return apiClient.delete<void>(`/attachments/${attachmentId}`);
  },
};
