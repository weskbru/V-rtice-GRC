import { apiClient } from '@/lib/api-client';

import type {
  CreateProcessRequest,
  OrgUnitNode,
  Page,
  ProcessDetail,
  ProcessIncidentLink,
  ProcessListQuery,
  ProcessSummary,
  UpdateProcessRequest,
} from './types';

function buildListQueryString(query: ProcessListQuery): string {
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

export const processesApi = {
  listCatalog(query: ProcessListQuery): Promise<Page<ProcessSummary>> {
    return apiClient.get<Page<ProcessSummary>>(`/processes?${buildListQueryString(query)}`);
  },

  getProcess(processId: string): Promise<ProcessDetail> {
    return apiClient.get<ProcessDetail>(`/processes/${processId}`);
  },

  createProcess(body: CreateProcessRequest): Promise<ProcessDetail> {
    return apiClient.post<ProcessDetail>('/processes', body);
  },

  updateProcess(processId: string, body: UpdateProcessRequest): Promise<ProcessDetail> {
    return apiClient.patch<ProcessDetail>(`/processes/${processId}`, body);
  },

  deactivateProcess(processId: string): Promise<ProcessDetail> {
    return apiClient.post<ProcessDetail>(`/processes/${processId}/deactivate`);
  },

  reactivateProcess(processId: string): Promise<ProcessDetail> {
    return apiClient.post<ProcessDetail>(`/processes/${processId}/reactivate`);
  },

  listIncidentLinks(
    processId: string,
    includeWithdrawn = false,
  ): Promise<readonly ProcessIncidentLink[]> {
    return apiClient.get<readonly ProcessIncidentLink[]>(
      `/processes/${processId}/incidents?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  listOrgUnits(): Promise<OrgUnitNode[]> {
    return apiClient.get<OrgUnitNode[]>('/org-units');
  },
};
