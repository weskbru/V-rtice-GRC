/**
 * PharosGRC — Report API wrapper (009-indicators-reports, T062/T061). Every request/response
 * shape below is typed straight from the generated `@pharos/api-types` `Reports` namespace
 * (`./types`), never a hand-written mirror, mirroring `features/indicators/api.ts`'s own
 * conventions (same `apiClient`, same error handling — `apiClient` itself normalizes failures
 * into `ApiProblem`/`ApiError`, nothing re-wrapped here).
 *
 * ## CSV export is a plain navigation URL, never a fetched blob
 *
 * `buildRunCsvUrl` returns the same `/reports/{reportId}/run` path `run()` calls, with
 * `format=csv` appended, exactly matching `AttachmentList`'s own documented convention
 * (`packages/design-system/src/components/collaboration/attachment-list.tsx`'s header, "Download
 * is a plain navigation, never a fetched blob"): the caller renders it as a real `<a href>` so the
 * browser's own credentialed, same-origin navigation re-authorizes the request (ADR-014), and the
 * server's own `Content-Disposition: attachment` header (`ReportController.run`,
 * `buildContentDispositionHeader`) is what makes the browser download rather than navigate. The
 * literal `/api/v1` prefix mirrors the server's own `contentUrl` values (e.g.
 * `attachment-response.mapper.ts`'s `API_PATH_PREFIX`) — there is no single-fetch
 * `GET /reports/{reportId}` this client could otherwise read a ready-made URL from
 * (`getReportDefinition` is declared in the contract but not implemented, `./types`'s own header).
 */
import { apiClient } from '@/lib/api-client';

import type {
  CreateReportDefinitionRequest,
  ReportDefinition,
  ReportDefinitionListQuery,
  ReportDefinitionListResponse,
  ReportRunResult,
} from './types';

const API_ROOT = '/api/v1';

/** Builds `GET /reports`'s query string exactly per its contract: `page`/`pageSize` always set, `isActive` only when the caller actually chose a value (an unset filter must not become `isActive=undefined` in the URL). */
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
  /** `GET /reports` — the saved-report catalog. */
  listDefinitions(query: ReportDefinitionListQuery): Promise<ReportDefinitionListResponse> {
    return apiClient.get<ReportDefinitionListResponse>(
      `/reports?${buildDefinitionListQueryString(query)}`,
    );
  },

  /** `POST /reports` — creates a saved report. `code` is server-assigned (`RPT-YYYY-NNNN`), never client-supplied. */
  createDefinition(body: CreateReportDefinitionRequest): Promise<ReportDefinition> {
    return apiClient.post<ReportDefinition>('/reports', body);
  },

  /** `GET /reports/{reportId}/run` (`format=json`, the default) — recomputed live on every call, never stored. An item whose source permission the caller lacks comes back with `available: false`, never a `403` for the whole call (FR-026, SC-006). */
  run(reportId: string): Promise<ReportRunResult> {
    return apiClient.get<ReportRunResult>(`/reports/${reportId}/run`);
  },

  /** Same operation as `run`, requested as `text/csv` via `format=csv` — see this module's own header for why this returns a URL rather than fetching bytes. */
  buildRunCsvUrl(reportId: string): string {
    return `${API_ROOT}/reports/${reportId}/run?format=csv`;
  },
};
