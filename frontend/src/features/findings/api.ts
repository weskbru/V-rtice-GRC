import { apiClient } from '@/lib/api-client';

import type {
  CloseFindingRequest,
  ControlRef,
  CreateFindingControlLinkRequest,
  CreateFindingRequest,
  CreateFindingRiskLinkRequest,
  Finding,
  FindingControlLink,
  FindingPage,
  FindingRiskLink,
  FindingSummary,
  ReopenFindingRequest,
  RiskRef,
  UpdateFindingRequest,
} from './types';
import type { Page, RegistrySearchResult, UserRef } from '@/features/risks/types';

export const findingsApi = {
  async listByOrgUnit(orgUnitId: string): Promise<FindingPage> {
    return apiClient.get<FindingPage>(`/findings?orgUnitId=${orgUnitId}&pageSize=100`);
  },

  async getFinding(findingId: string): Promise<Finding> {
    return apiClient.get<Finding>(`/findings/${findingId}`);
  },

  async createFinding(body: CreateFindingRequest): Promise<Finding> {
    return apiClient.post<Finding>('/findings', body);
  },

  async updateFinding(findingId: string, body: UpdateFindingRequest): Promise<Finding> {
    return apiClient.patch<Finding>(`/findings/${findingId}`, body);
  },

  async closeFinding(findingId: string, body: CloseFindingRequest): Promise<Finding> {
    return apiClient.post<Finding>(`/findings/${findingId}/close`, body);
  },

  async reopenFinding(findingId: string, body: ReopenFindingRequest): Promise<Finding> {
    return apiClient.post<Finding>(`/findings/${findingId}/reopen`, body);
  },

  async archiveFinding(findingId: string): Promise<Finding> {
    return apiClient.post<Finding>(`/findings/${findingId}/archive`);
  },

  async searchUsers(q: string): Promise<{ data: readonly UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  async startRemediation(findingId: string): Promise<FindingSummary> {
    return apiClient.post<FindingSummary>(`/findings/${findingId}/start-remediation`);
  },

  listControlLinks(
    findingId: string,
    includeWithdrawn = false,
  ): Promise<readonly FindingControlLink[]> {
    return apiClient.get<readonly FindingControlLink[]>(
      `/findings/${findingId}/controls?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkControl(
    findingId: string,
    body: CreateFindingControlLinkRequest,
  ): Promise<FindingControlLink> {
    return apiClient.post<FindingControlLink>(`/findings/${findingId}/controls`, body);
  },

  unlinkControl(findingId: string, linkId: string): Promise<FindingControlLink> {
    return apiClient.delete<FindingControlLink>(`/findings/${findingId}/controls/${linkId}`);
  },

  listRiskLinks(findingId: string, includeWithdrawn = false): Promise<readonly FindingRiskLink[]> {
    return apiClient.get<readonly FindingRiskLink[]>(
      `/findings/${findingId}/risks?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkRisk(findingId: string, body: CreateFindingRiskLinkRequest): Promise<FindingRiskLink> {
    return apiClient.post<FindingRiskLink>(`/findings/${findingId}/risks`, body);
  },

  unlinkRisk(findingId: string, linkId: string): Promise<FindingRiskLink> {
    return apiClient.delete<FindingRiskLink>(`/findings/${findingId}/risks/${linkId}`);
  },

  async listControlOptions(q: string): Promise<RegistrySearchResult<ControlRef>> {
    const page = await apiClient.get<Page<ControlRef>>(
      `/controls?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  async listRiskOptions(q: string): Promise<RegistrySearchResult<RiskRef>> {
    const page = await apiClient.get<Page<RiskRef>>(
      `/risks?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },
};
