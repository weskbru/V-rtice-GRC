import { apiClient } from '@/lib/api-client';

import type { DashboardResponse, DashboardSummaryResponse } from './types';

export const dashboardApi = {
  getDashboard: (): Promise<DashboardResponse> => apiClient.get<DashboardResponse>('/dashboard'),

  getSummary: (): Promise<DashboardSummaryResponse> =>
    apiClient.get<DashboardSummaryResponse>('/dashboard/summary'),
};
