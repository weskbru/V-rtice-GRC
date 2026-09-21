/**
 * PharosGRC frontend — GRC dashboard API wrapper (T198/T199).
 *
 * A thin, typed layer over `apiClient` for `GET /dashboard`
 * (`contracts/platform.openapi.yaml` ~414), matching the shape of
 * `apps/web/src/features/risks/api.ts`. No client-side computation of any
 * kind happens on the result — every figure this feature displays is the
 * value this call returns, unmodified (ADR-006, Constitution VI).
 */
import { apiClient } from '@/lib/api-client';

import type { DashboardResponse, DashboardSummaryResponse } from './types';

export const dashboardApi = {
  getDashboard: (): Promise<DashboardResponse> => apiClient.get<DashboardResponse>('/dashboard'),

  /**
   * `GET /dashboard/summary` — the cross-domain half of the landing screen.
   * A separate request from `getDashboard` because the two are owned by
   * different modules: the risk areas stay with `modules/risk`, and the
   * platform catalogue could not join them there (`core/**` may never import
   * `modules/**`, and `modules/risk` is barred by its own boundary guards
   * from importing Controls, Compliance or Audit). Two aggregated requests,
   * not one request per module and never a register list fetched to count
   * its length.
   */
  getSummary: (): Promise<DashboardSummaryResponse> =>
    apiClient.get<DashboardSummaryResponse>('/dashboard/summary'),
};
