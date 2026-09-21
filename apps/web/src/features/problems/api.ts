/**
 * PharosGRC frontend — Problem Management API wrapper (008-incidents-
 * problems, US2/US3). Frontend-facing scaffold (coordinator instruction,
 * 2026-09-11) — see `features/incidents/api.ts`'s own header comment for
 * the full reasoning: no `If-Match`/`ETag` anywhere here, every request
 * shape comes from the generated `@pharos/api-types` `Problems` namespace.
 *
 * **Problems owns the WRITE side of the shared Problem<->Incident
 * many-to-many** (research.md D-14): `linkToIncident`/`unlinkFromIncident`
 * exist ONLY here — `features/incidents/api.ts` exposes just
 * `listProblemLinks` (read-only) for the same table. Neither this file nor
 * that one ever inspects the OTHER record's lifecycle status before acting
 * on its own (research.md D-15) — `transition` below never reads an
 * incident's status, and never will without a new, explicit decision.
 */
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

/** `GET /actions`'s own page envelope — a MINIMAL, LOCAL shape (this file
 * declares its own registry-fetch rather than importing `features/actions/
 * api.ts`, mirroring `finding-links-section.tsx`'s own documented
 * discipline: business modules do not depend on each other's feature
 * code). Only the one field `hasCompletedCorrectiveAction` below actually
 * reads. */
interface ActionExistencePage {
  readonly total: number;
}

/** `GET /risks`'s own minimal projection needed by the risk picker
 * (`{id, code, title}`) — declared LOCALLY rather than importing the
 * risk module's own `RiskRef`, mirroring `features/findings/types.ts`'s
 * identical precedent (that file declares its own `RiskRef`/`ControlRef`
 * rather than reusing the risk module's, even though only `Page`/
 * `RegistrySearchResult`/`UserRef` — generic, structural helpers, not
 * domain ref shapes — are ever reused from `features/risks/types`). */
export interface RiskSearchOption {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

/** `GET /incidents`'s own minimal projection needed by the incident
 * picker (`{id, code, title}`) — same reasoning as `RiskSearchOption`
 * above, declared locally rather than importing `features/incidents/types`
 * for a business-logic type. */
export interface IncidentSearchOption {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

/** Builds `GET /problems`'s query string exactly per its contract: repeated `style: form, explode: true` array parameters, omitting any filter the caller did not set. */
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
  /** `GET /problems` — the problem register (US2). Always paginated; never fetches more than one page. */
  listRegister(query: ProblemRegisterQuery): Promise<ProblemListResponse> {
    return apiClient.get<ProblemListResponse>(`/problems?${buildRegisterQueryString(query)}`);
  },

  /** `GET /problems/{problemId}` — one problem's full detail. */
  getById(problemId: string): Promise<ProblemDetail> {
    return apiClient.get<ProblemDetail>(`/problems/${problemId}`);
  },

  /** `POST /problems` — register a new problem; `code` is server-assigned, never client-supplied. */
  create(body: CreateProblemRequest): Promise<ProblemDetail> {
    return apiClient.post<ProblemDetail>('/problems', body);
  },

  /** `PATCH /problems/{problemId}` — edits descriptive fields only; never accepts `status`, `code`, `rootCause`, or any resolution/cancellation field (those exist only through `transition`). */
  update(problemId: string, body: UpdateProblemRequest): Promise<ProblemDetail> {
    return apiClient.patch<ProblemDetail>(`/problems/${problemId}`, body);
  },

  /**
   * `POST /problems/{problemId}/transitions` — the sole writer of `status`
   * (data-model.md, research.md D-5). Legal moves: `OPEN->IN_ANALYSIS`,
   * `OPEN->CANCELLED`, `IN_ANALYSIS->RESOLVED`, `IN_ANALYSIS->CANCELLED`,
   * `RESOLVED->CLOSED`, `RESOLVED->IN_ANALYSIS` (reopen, requires
   * `reopenReason`). `toStatus: RESOLVED` requires `rootCause`.
   * `toStatus: CLOSED` requires, checked server-side at transition time
   * (research.md D-7, never cached from creation): a completed `Action` of
   * origin `PROBLEM` for this record, AND a closer different from whoever
   * completed that action (segregation of duties — unlike `Incident`'s own
   * `CLOSED` transition, D-6). This client never pre-validates any of
   * that; the server's `422` is the single source of truth.
   */
  transition(problemId: string, body: TransitionProblemRequest): Promise<ProblemDetail> {
    return apiClient.post<ProblemDetail>(`/problems/${problemId}/transitions`, body);
  },

  /** `GET /problems/{problemId}/risks` (US3). */
  listRiskLinks(
    problemId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemRiskLinkResponse[]> {
    return apiClient.get<readonly ProblemRiskLinkResponse[]>(
      `/problems/${problemId}/risks?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  /** `POST /problems/{problemId}/risks` — requires `problem:link` **and** `risk:view` (ADR-020 part 5); an out-of-scope or nonexistent risk both answer `404`. */
  linkRisk(problemId: string, riskId: string): Promise<ProblemRiskLinkResponse> {
    return apiClient.post<ProblemRiskLinkResponse>(`/problems/${problemId}/risks`, { riskId });
  },

  /** `DELETE /problems/{problemId}/risks/{linkId}` — withdraws, never deletes; the row keeps `unlinkedAt`. */
  unlinkRisk(problemId: string, linkId: string): Promise<ProblemRiskLinkResponse> {
    return apiClient.delete<ProblemRiskLinkResponse>(`/problems/${problemId}/risks/${linkId}`);
  },

  /**
   * `GET /problems/{problemId}/incidents` (US3) — the read side of the
   * shared link, symmetric with `incidentsApi.listProblemLinks`.
   */
  listIncidentLinks(
    problemId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemIncidentLinkResponse[]> {
    return apiClient.get<readonly ProblemIncidentLinkResponse[]>(
      `/problems/${problemId}/incidents?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  /**
   * `POST /problems/{problemId}/incidents` — the ONLY write path for the
   * shared Problem<->Incident link (research.md D-14). Requires
   * `problem:link` **and** `incident:view`; an out-of-scope or nonexistent
   * incident both answer `404`. Never gates either lifecycle (D-15) —
   * creating this link changes nothing about what transitions either
   * record may still make.
   */
  linkToIncident(problemId: string, incidentId: string): Promise<ProblemIncidentLinkResponse> {
    return apiClient.post<ProblemIncidentLinkResponse>(`/problems/${problemId}/incidents`, {
      incidentId,
    });
  },

  /** `DELETE /problems/{problemId}/incidents/{linkId}` — withdraws, never deletes; the only write path for this link (D-14), symmetric with `linkToIncident` above. */
  unlinkFromIncident(problemId: string, linkId: string): Promise<ProblemIncidentLinkResponse> {
    return apiClient.delete<ProblemIncidentLinkResponse>(
      `/problems/${problemId}/incidents/${linkId}`,
    );
  },

  // -------------------------------------------------------------------
  // Reference data for `ProblemForm` — each module declares its OWN copy
  // of these two calls against the shared endpoints (`/org-units`,
  // `/users`), the same convention `risksApi`/`assetsApi` each already
  // follow, never a shared cross-feature helper.
  // -------------------------------------------------------------------

  /** `GET /org-units` — every organizational unit, for the create/edit form's own picker (not scoped to the caller — the server re-checks scope on write, mirroring `AssetForm`'s identical reasoning). */
  listOrgUnits(): Promise<OrgUnitNode[]> {
    return apiClient.get<OrgUnitNode[]>('/org-units');
  },

  /**
   * `GET /users?q=` — the owner-assignment lookup, searched server-side now
   * (S-10: this project's own development database already has more than
   * 100 users — a fixed `pageSize=100` with no search silently hid every
   * owner beyond the first page), mirroring `risksApi.searchUsers`'s own
   * doc comment.
   */
  async searchUsers(q: string): Promise<{ data: RisksUserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<RisksUserRef>>(`/users?${params.toString()}`);
    return { data: [...page.data], isPartial: page.data.length < page.meta.total };
  },

  // -------------------------------------------------------------------
  // Registry pickers for the two link sections (US3) — a direct,
  // independent read of each registry's own list endpoint, mirroring
  // `findingsApi.listRiskOptions`/`.listControlOptions`'s own convention
  // (a business module declares its OWN minimal registry-fetch rather
  // than importing another feature's API client). Neither picker filters
  // by the target's own status — an archived risk or a closed incident
  // still appears, history is preserved by design.
  // -------------------------------------------------------------------

  /** `GET /risks?pageSize=25&q=` — same reasoning as `findingsApi.listRiskOptions`. */
  async listRiskOptions(q: string): Promise<RegistrySearchResult<RiskSearchOption>> {
    const page = await apiClient.get<Page<RiskSearchOption>>(
      `/risks?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  /** `GET /incidents?pageSize=25&search=` — the incident picker's own search source (Front H: server-side, never a single unsearched first page). */
  async listIncidentOptions(q: string): Promise<RegistrySearchResult<IncidentSearchOption>> {
    const page = await apiClient.get<Page<IncidentSearchOption>>(
      `/incidents?pageSize=25${q ? `&search=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: [...page.data], isPartial: page.data.length < page.meta.total };
  },

  /**
   * Front L (closure legibility, CLAUDE.md §18.11) — cheaply, reliably
   * knowable client-side precondition for `toStatus: CLOSED` (data-model.md
   * P2): does a `COMPLETED` `Action` of `originType: PROBLEM` for this
   * problem already exist? Mirrors `FindingCloseDialog`'s own evidence
   * check exactly — one read, checked when the close dialog opens, never
   * cached from an earlier moment. Segregation of duties (P3) is
   * deliberately NOT checked here — the client has no reliable way to know
   * who completed the qualifying action without a second, dedicated query,
   * the same limitation `finding-close-dialog.tsx`'s own header documents
   * for Invariant F2; the server's `403` remains the single source of
   * truth for that one.
   */
  async hasCompletedCorrectiveAction(problemId: string): Promise<boolean> {
    const page = await apiClient.get<ActionExistencePage>(
      `/actions?originType=PROBLEM&originId=${problemId}&status=COMPLETED&page=1&pageSize=1`,
    );
    return page.total > 0;
  },

  // -------------------------------------------------------------------
  // Comments and attachments (CLAUDE.md §19.10 remediation) — the SAME
  // generic `/comments`/`/attachments` endpoints `risksApi`/`incidentsApi`
  // already use (ADR-008's entity-type registry), with
  // `entityType: 'PROBLEM'` fixed here because this is the Problem
  // feature's own wrapper. The backend registration
  // (`ProblemParentRecordAccessor`) existed since this module's foundation
  // with no reachable interface — see `test/integration/
  // incident-problem-collaboration.spec.ts`.
  // -------------------------------------------------------------------

  /** `GET /comments?entityType=PROBLEM&entityId=...` — every comment on this problem, newest first. Withdrawn comments are already omitted server-side. */
  listComments(problemId: string, page: number, pageSize: number): Promise<Page<Comment>> {
    return apiClient.get<Page<Comment>>(
      `/comments?entityType=PROBLEM&entityId=${problemId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  /** `POST /comments` — requires `comment:create` plus `problem:view`. The author/timestamp come from the session server-side. */
  createComment(problemId: string, body: string): Promise<Comment> {
    return apiClient.post<Comment>('/comments', {
      entityType: 'PROBLEM',
      entityId: problemId,
      body,
    });
  },

  /** `DELETE /comments/{commentId}` — withdraws (never erases) the comment. */
  withdrawComment(commentId: string): Promise<void> {
    return apiClient.delete<void>(`/comments/${commentId}`);
  },

  /** `GET /attachments?entityType=PROBLEM&entityId=...` — every attachment's metadata on this problem, newest first. */
  listAttachments(problemId: string, page: number, pageSize: number): Promise<Page<Attachment>> {
    return apiClient.get<Page<Attachment>>(
      `/attachments?entityType=PROBLEM&entityId=${problemId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  /** `POST /attachments` (`multipart/form-data`) — requires `attachment:create` plus `problem:view`. */
  async uploadAttachment(problemId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.set('entityType', 'PROBLEM');
    formData.set('entityId', problemId);
    formData.set('file', file);
    const { data } = await apiClient.postFormWithMeta<Attachment>('/attachments', formData);
    return data;
  },

  /** `DELETE /attachments/{attachmentId}` — withdraws (never erases) the attachment. */
  withdrawAttachment(attachmentId: string): Promise<void> {
    return apiClient.delete<void>(`/attachments/${attachmentId}`);
  },
};
