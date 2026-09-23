import { apiClient } from '@/lib/api-client';

import type {
  CreateReportDefinitionRequest,
  ReportDefinition,
  ReportDefinitionListQuery,
  ReportDefinitionListResponse,
  ReportRunResult,
} from './types';

const API_ROOT = '/api/v1';

function buildDefinitionListQueryString(query: ReportDefinitionListQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.isActive !== undefined) {
    params.set('isActive', String(query.isActive));
  }
  return params.toString();
}

export const reportsApi = {
  listDefinitions(query: ReportDefinitionListQuery): Promise<ReportDefinitionListResponse> {
    return apiClient.get<ReportDefinitionListResponse>(
      `/reports?${buildDefinitionListQueryString(query)}`,
    );
  },

  createDefinition(body: CreateReportDefinitionRequest): Promise<ReportDefinition> {
    return apiClient.post<ReportDefinition>('/reports', body);
  },

  run(reportId: string): Promise<ReportRunResult> {
    return apiClient.get<ReportRunResult>(`/reports/${reportId}/run`);
  },

  buildRunCsvUrl(reportId: string): string {
    return `${API_ROOT}/reports/${reportId}/run?format=csv`;
  },
};
