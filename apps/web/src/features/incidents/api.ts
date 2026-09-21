/**
 * PharosGRC frontend — Incident Management API wrapper (008-incidents-
 * problems, US1/US3). Frontend-facing scaffold (coordinator instruction,
 * 2026-09-11) — the backend behind this contract is being built by a
 * separate front; every request shape below is typed straight from the
 * generated `@pharos/api-types` `Incidents` namespace (`./types`), never a
 * hand-written mirror.
 *
 * Unlike `risksApi`/`controlsApi`, nothing here carries `If-Match`/`ETag` —
 * `incidents.openapi.yaml` declares no optimistic-locking `version` field
 * on `Incident` at all, so every mutation below is a plain `apiClient`
 * call.
 *
 * The relationship to `Problem` is READ-ONLY here (research.md D-14):
 * `listProblemLinks` is the only operation this file exposes for that
 * side — `problems.openapi.yaml`/`problemsApi` owns
 * `linkToIncident`/`unlinkFromIncident`. Nothing here inspects a linked
 * problem's status before allowing an incident transition, and nothing
 * ever will without a new, explicit decision (research.md D-15,
 * "nenhum acoplamento rígido entre os dois fechamentos").
 */
import { apiClient } from '@/lib/api-client';

import type {
  AssetRef,
  CreateIncidentRequest,
  IncidentAssetLinkResponse,
  IncidentDetail,
  IncidentListResponse,
  IncidentProblemLinkResponse,
  IncidentProcessLinkResponse,
  IncidentRegisterQuery,
  IncidentRiskLinkResponse,
  ProcessRef,
  RiskRef,
  TransitionIncidentRequest,
  UpdateIncidentRequest,
} from './types';
import type {
  Attachment,
  Comment,
  OrgUnitNode,
  Page,
  RegistrySearchResult,
  UserRef as RisksUserRef,
} from '@/features/risks/types';

/** Builds `GET /incidents`'s query string exactly per its contract: repeated `style: form, explode: true` array parameters, omitting any filter the caller did not set. */
function buildRegisterQueryString(query: IncidentRegisterQuery): string {
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

export const incidentsApi = {
  /** `GET /incidents` — the incident register (US1). Always paginated; never fetches more than one page. */
  listRegister(query: IncidentRegisterQuery): Promise<IncidentListResponse> {
    return apiClient.get<IncidentListResponse>(`/incidents?${buildRegisterQueryString(query)}`);
  },

  /** `GET /incidents/{incidentId}` — one incident's full detail. */
  getById(incidentId: string): Promise<IncidentDetail> {
    return apiClient.get<IncidentDetail>(`/incidents/${incidentId}`);
  },

  /** `POST /incidents` — register a new incident; `code` is server-assigned, never client-supplied. */
  create(body: CreateIncidentRequest): Promise<IncidentDetail> {
    return apiClient.post<IncidentDetail>('/incidents', body);
  },

  /** `PATCH /incidents/{incidentId}` — edits descriptive fields only; never accepts `status`, `code`, or any resolution/cancellation field (those exist only through `transition`). */
  update(incidentId: string, body: UpdateIncidentRequest): Promise<IncidentDetail> {
    return apiClient.patch<IncidentDetail>(`/incidents/${incidentId}`, body);
  },

  /**
   * `POST /incidents/{incidentId}/transitions` — the sole writer of
   * `status` (data-model.md, research.md D-4). Legal moves:
   * `OPEN->IN_PROGRESS`, `OPEN->CANCELLED`, `IN_PROGRESS->RESOLVED`,
   * `IN_PROGRESS->CANCELLED`, `RESOLVED->CLOSED`,
   * `RESOLVED->IN_PROGRESS` (reopen, requires `reopenReason`). Any other
   * move answers `422`, along with a `RESOLVED` request missing
   * `resolutionSummary` or a `CANCELLED` one missing `cancellationReason`
   * (data-model.md I1/I2) — this client never pre-validates those; the
   * server's `422` is the single source of truth (D-6: closing needs no
   * second approver, unlike `Problem`).
   */
  transition(incidentId: string, body: TransitionIncidentRequest): Promise<IncidentDetail> {
    return apiClient.post<IncidentDetail>(`/incidents/${incidentId}/transitions`, body);
  },

  /** `GET /incidents/{incidentId}/risks` (US3). */
  listRiskLinks(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentRiskLinkResponse[]> {
    return apiClient.get<readonly IncidentRiskLinkResponse[]>(
      `/incidents/${incidentId}/risks?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  /** `POST /incidents/{incidentId}/risks` — requires `incident:link` **and** `risk:view` (ADR-020 part 5); an out-of-scope or nonexistent risk both answer `404`. */
  linkRisk(incidentId: string, riskId: string): Promise<IncidentRiskLinkResponse> {
    return apiClient.post<IncidentRiskLinkResponse>(`/incidents/${incidentId}/risks`, { riskId });
  },

  /** `DELETE /incidents/{incidentId}/risks/{linkId}` — withdraws, never deletes; the row keeps `unlinkedAt`. */
  unlinkRisk(incidentId: string, linkId: string): Promise<IncidentRiskLinkResponse> {
    return apiClient.delete<IncidentRiskLinkResponse>(`/incidents/${incidentId}/risks/${linkId}`);
  },

  /** `GET /incidents/{incidentId}/assets` (US3). */
  listAssetLinks(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentAssetLinkResponse[]> {
    return apiClient.get<readonly IncidentAssetLinkResponse[]>(
      `/incidents/${incidentId}/assets?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  /** `POST /incidents/{incidentId}/assets` — requires `incident:link` **and** `asset:view`. */
  linkAsset(incidentId: string, assetId: string): Promise<IncidentAssetLinkResponse> {
    return apiClient.post<IncidentAssetLinkResponse>(`/incidents/${incidentId}/assets`, {
      assetId,
    });
  },

  /** `DELETE /incidents/{incidentId}/assets/{linkId}` — withdraws, never deletes. */
  unlinkAsset(incidentId: string, linkId: string): Promise<IncidentAssetLinkResponse> {
    return apiClient.delete<IncidentAssetLinkResponse>(`/incidents/${incidentId}/assets/${linkId}`);
  },

  /** `GET /incidents/{incidentId}/processes` (US3). */
  listProcessLinks(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProcessLinkResponse[]> {
    return apiClient.get<readonly IncidentProcessLinkResponse[]>(
      `/incidents/${incidentId}/processes?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  /** `POST /incidents/{incidentId}/processes` — requires `incident:link` **and** `process:view`. */
  linkProcess(incidentId: string, processId: string): Promise<IncidentProcessLinkResponse> {
    return apiClient.post<IncidentProcessLinkResponse>(`/incidents/${incidentId}/processes`, {
      processId,
    });
  },

  /** `DELETE /incidents/{incidentId}/processes/{linkId}` — withdraws, never deletes. */
  unlinkProcess(incidentId: string, linkId: string): Promise<IncidentProcessLinkResponse> {
    return apiClient.delete<IncidentProcessLinkResponse>(
      `/incidents/${incidentId}/processes/${linkId}`,
    );
  },

  /**
   * `GET /incidents/{incidentId}/problems` — READ-ONLY (research.md D-14).
   * Reads `problem_incident_links` directly; this module never writes to
   * it. There is no `linkProblem`/`unlinkProblem` here on purpose —
   * `problemsApi.linkToIncident`/`.unlinkFromIncident` in
   * `features/problems/api.ts` are the only write path.
   */
  listProblemLinks(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProblemLinkResponse[]> {
    return apiClient.get<readonly IncidentProblemLinkResponse[]>(
      `/incidents/${incidentId}/problems?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  // -------------------------------------------------------------------
  // Reference data for `IncidentForm` — this module's own copy of the two
  // shared-endpoint calls, mirroring `problemsApi.listOrgUnits`/`.searchUsers`
  // (each business module declares its own, per CLAUDE.md §2/§4 — never a
  // cross-module import of another feature's API client).
  // -------------------------------------------------------------------

  /** `GET /org-units` — every organizational unit, for the create form's own picker; the server re-checks scope on write. */
  listOrgUnits(): Promise<OrgUnitNode[]> {
    return apiClient.get<OrgUnitNode[]>('/org-units');
  },

  /**
   * `GET /users?q=` — the owner-assignment lookup, searched server-side now
   * (S-10: a fixed `pageSize=100` with no search silently hid every owner
   * beyond the first page), mirroring `problemsApi.searchUsers`'s own doc
   * comment.
   */
  async searchUsers(q: string): Promise<{ data: RisksUserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<RisksUserRef>>(`/users?${params.toString()}`);
    return { data: [...page.data], isPartial: page.data.length < page.meta.total };
  },

  // -------------------------------------------------------------------
  // Registry pickers for the three writable link sections (US3) — each a
  // direct, independent read of its own registry's list endpoint, mirroring
  // `problemsApi.listRiskOptions`'s own convention. Neither picker filters
  // by the target's own status — an archived risk, an inactive asset or a
  // retired process still appears; history is preserved by design.
  // -------------------------------------------------------------------

  /** `GET /risks?pageSize=25&q=` — same reasoning as `problemsApi.listRiskOptions`. */
  async listRiskOptions(q: string): Promise<RegistrySearchResult<RiskRef>> {
    const page = await apiClient.get<Page<RiskRef>>(
      `/risks?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  /** `GET /assets?pageSize=25&q=` — requires `asset:view`, never `incident:view`. */
  async listAssetOptions(q: string): Promise<RegistrySearchResult<AssetRef>> {
    const page = await apiClient.get<Page<AssetRef>>(
      `/assets?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  /** `GET /processes?pageSize=25&q=` — requires `process:view`, never `incident:view`. */
  async listProcessOptions(q: string): Promise<RegistrySearchResult<ProcessRef>> {
    const page = await apiClient.get<Page<ProcessRef>>(
      `/processes?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  // -------------------------------------------------------------------
  // Comments and attachments (CLAUDE.md §19.10 remediation) — the SAME
  // generic `/comments`/`/attachments` endpoints `risksApi` already uses
  // (ADR-008's entity-type registry), with `entityType: 'INCIDENT'` fixed
  // here because this is the Incident feature's own wrapper. The backend
  // registration (`IncidentParentRecordAccessor`) existed since this
  // module's foundation with no reachable interface — see
  // `test/integration/incident-problem-collaboration.spec.ts`.
  // -------------------------------------------------------------------

  /** `GET /comments?entityType=INCIDENT&entityId=...` — every comment on this incident, newest first. Withdrawn comments are already omitted server-side. */
  listComments(incidentId: string, page: number, pageSize: number): Promise<Page<Comment>> {
    return apiClient.get<Page<Comment>>(
      `/comments?entityType=INCIDENT&entityId=${incidentId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  /** `POST /comments` — requires `comment:create` plus `incident:view`. The author/timestamp come from the session server-side. */
  createComment(incidentId: string, body: string): Promise<Comment> {
    return apiClient.post<Comment>('/comments', {
      entityType: 'INCIDENT',
      entityId: incidentId,
      body,
    });
  },

  /** `DELETE /comments/{commentId}` — withdraws (never erases) the comment. */
  withdrawComment(commentId: string): Promise<void> {
    return apiClient.delete<void>(`/comments/${commentId}`);
  },

  /** `GET /attachments?entityType=INCIDENT&entityId=...` — every attachment's metadata on this incident, newest first. */
  listAttachments(incidentId: string, page: number, pageSize: number): Promise<Page<Attachment>> {
    return apiClient.get<Page<Attachment>>(
      `/attachments?entityType=INCIDENT&entityId=${incidentId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  /** `POST /attachments` (`multipart/form-data`) — requires `attachment:create` plus `incident:view`. */
  async uploadAttachment(incidentId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.set('entityType', 'INCIDENT');
    formData.set('entityId', incidentId);
    formData.set('file', file);
    const { data } = await apiClient.postFormWithMeta<Attachment>('/attachments', formData);
    return data;
  },

  /** `DELETE /attachments/{attachmentId}` — withdraws (never erases) the attachment. */
  withdrawAttachment(attachmentId: string): Promise<void> {
    return apiClient.delete<void>(`/attachments/${attachmentId}`);
  },
};
