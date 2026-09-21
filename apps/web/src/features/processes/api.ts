/**
 * PharosGRC frontend — Process Management API wrapper (T045, 006-assets-processes).
 *
 * A thin, typed layer over `apiClient` for the six operations of
 * `specs/006-assets-processes/contracts/processes.openapi.yaml`, mirroring
 * `features/assets/api.ts` shape-for-shape (the contract's own description
 * calls the two documents "identical in form", FR-020) and `features/
 * controls/api.ts`'s/`features/audit-engagements/api.ts`'s own conventions.
 *
 * **No `If-Match`, anywhere in this file.** Unlike `controlsApi`'s/
 * `auditEngagementsApi`'s versioned mutations, none of the six operations
 * below reads or writes an entity-tag: `PATCH /processes/{processId}` and
 * the two lifecycle transitions apply last-write-wins directly to the row,
 * by this contract's own deliberate design (see `./types.ts`'s header
 * comment for why). Every call here uses the plain `apiClient.get`/`post`/
 * `patch` methods — never the `...WithMeta` variants those two other
 * clients need.
 */
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

/** Builds `GET /processes`'s query string exactly per its contract: comma-separated arrays (`style: form, explode: false`), omitting any filter the caller did not set. */
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
  /** `GET /processes` (`listProcessCatalog`) — the process catalog, restricted to the caller's authorized organizational scope (FR-009, FR-010). Always paginated; never fetches more than one page. */
  listCatalog(query: ProcessListQuery): Promise<Page<ProcessSummary>> {
    return apiClient.get<Page<ProcessSummary>>(`/processes?${buildListQueryString(query)}`);
  },

  /** `GET /processes/{processId}` — includes the risks and controls this process is currently linked to (FR-008). A caller outside the process's organizational scope receives the same `404` as a nonexistent id (non-disclosure). */
  getProcess(processId: string): Promise<ProcessDetail> {
    return apiClient.get<ProcessDetail>(`/processes/${processId}`);
  },

  /** `POST /processes` — `orgUnitId` is required (invariant A1) and must lie inside the caller's scope. The server assigns the `PRC-` prefixed `code`; the created process is always active. */
  createProcess(body: CreateProcessRequest): Promise<ProcessDetail> {
    return apiClient.post<ProcessDetail>('/processes', body);
  },

  /** `PATCH /processes/{processId}` — partial update of descriptive data. No `If-Match`: see this file's own header comment. */
  updateProcess(processId: string, body: UpdateProcessRequest): Promise<ProcessDetail> {
    return apiClient.patch<ProcessDetail>(`/processes/${processId}`, body);
  },

  /** `POST /processes/{processId}/deactivate` — no request body. The process stays fully readable and stays visible in every link it already has; only new links are refused from this point on (FR-006). Refused with `422` if already inactive. */
  deactivateProcess(processId: string): Promise<ProcessDetail> {
    return apiClient.post<ProcessDetail>(`/processes/${processId}/deactivate`);
  },

  /** `POST /processes/{processId}/reactivate` — no request body. Refused with `422` if already active. */
  reactivateProcess(processId: string): Promise<ProcessDetail> {
    return apiClient.post<ProcessDetail>(`/processes/${processId}/reactivate`);
  },

  /**
   * 013-incidents-problems-reverse-links — `GET
   * /processes/{processId}/incidents`, READ-ONLY: `modules/processes`
   * never writes `IncidentProcessLink` — the Incident side owns that write
   * path.
   */
  listIncidentLinks(
    processId: string,
    includeWithdrawn = false,
  ): Promise<readonly ProcessIncidentLink[]> {
    return apiClient.get<readonly ProcessIncidentLink[]>(
      `/processes/${processId}/incidents?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  // -------------------------------------------------------------------
  // Reference data
  // -------------------------------------------------------------------

  /** `GET /org-units` — already restricted to the caller's authorized scope by the server; the create/edit form's organizational unit picker. */
  listOrgUnits(): Promise<OrgUnitNode[]> {
    return apiClient.get<OrgUnitNode[]>('/org-units');
  },
};
