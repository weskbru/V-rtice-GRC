/**
 * PharosGRC frontend — Risk Management API wrapper (T095–T099).
 *
 * A thin, typed layer over `apiClient` for the risk endpoints this user
 * story uses. Every mutation of a risk or a risk-owned child carries the
 * `If-Match` header, and every read/write of a risk returns the `ETag` the
 * next mutation must echo (ADR-013) — callers never touch the raw header
 * name directly.
 */
import { apiClient } from '@/lib/api-client';

import type {
  Approval,
  ApprovalDecisionRequest,
  Attachment,
  AuditEvent,
  Comment,
  CreateRiskAssessmentRequest,
  CreateRiskRequest,
  CreateRiskTreatmentActionRequest,
  CreateRiskTreatmentDecisionRequest,
  LinkEntityRequest,
  OrgUnitNode,
  Page,
  ReferenceDataItem,
  RegistryItem,
  RegistrySearchResult,
  RequestApprovalRequest,
  RiskAssessment,
  RiskControlLink,
  RiskDetail,
  RiskEntityLink,
  RiskHistoryEntry,
  RiskHistoryEntryType,
  RiskIncidentLink,
  RiskLifecycleState,
  RiskLifecycleTransition,
  RiskMethodologyVersion,
  RiskProblemLink,
  RiskRegisterQuery,
  RiskStatement,
  RiskSummary,
  RiskTreatmentAction,
  RiskTreatmentDecision,
  TransitionRiskRequest,
  TreatmentActionStatus,
  UpdateRiskRequest,
  UpdateRiskTreatmentActionRequest,
  UserRef,
} from './types';

/** A risk together with the entity-tag its next mutation must echo in `If-Match` (ADR-013). */
export interface RiskWithVersion {
  risk: RiskDetail;
  etag: string;
}

/** Falls back to a quoted `version` when a response genuinely carries no `ETag` header, so a caller always has a value to send — this should not happen against a contract-conformant API, but never leaves the caller without an `If-Match` value to retry with. */
function resolveEtag(etag: string | null, version: number): string {
  return etag ?? `"${version}"`;
}

/** Builds the `GET /risks` query string exactly per its contract: comma-separated arrays (`style: form, explode: false`), booleans/enums as plain strings, omitting any filter the caller did not set rather than sending an empty value (T110–T112, FR-086 to FR-090). */
function buildRegisterQueryString(query: RiskRegisterQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.status && query.status.length > 0) params.set('status', query.status.join(','));
  if (query.riskLevel && query.riskLevel.length > 0)
    params.set('riskLevel', query.riskLevel.join(','));
  if (query.riskLevelBasis) params.set('riskLevelBasis', query.riskLevelBasis);
  if (query.categoryId && query.categoryId.length > 0)
    params.set('categoryId', query.categoryId.join(','));
  if (query.orgUnitId && query.orgUnitId.length > 0)
    params.set('orgUnitId', query.orgUnitId.join(','));
  if (query.includeDescendants !== undefined)
    params.set('includeDescendants', String(query.includeDescendants));
  if (query.ownerUserId && query.ownerUserId.length > 0)
    params.set('ownerUserId', query.ownerUserId.join(','));
  if (query.overdueReview !== undefined) params.set('overdueReview', String(query.overdueReview));
  if (query.overdueTreatment !== undefined)
    params.set('overdueTreatment', String(query.overdueTreatment));
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);
  return params.toString();
}

export const risksApi = {
  /** `GET /risks` — the risk register (T110, FR-086 to FR-090, SC-004). Always paginated; never fetches more than one page. */
  listRegister(query: RiskRegisterQuery): Promise<Page<RiskSummary>> {
    return apiClient.get<Page<RiskSummary>>(`/risks?${buildRegisterQueryString(query)}`);
  },

  async getRisk(riskId: string): Promise<RiskWithVersion> {
    const { data, etag } = await apiClient.getWithMeta<RiskDetail>(`/risks/${riskId}`);
    return { risk: data, etag: resolveEtag(etag, data.version) };
  },

  async createRisk(body: CreateRiskRequest): Promise<RiskWithVersion> {
    const { data, etag } = await apiClient.postWithMeta<RiskDetail>('/risks', body);
    return { risk: data, etag: resolveEtag(etag, data.version) };
  },

  async updateRisk(
    riskId: string,
    body: UpdateRiskRequest,
    ifMatch: string,
  ): Promise<RiskWithVersion> {
    const { data, etag } = await apiClient.patchWithMeta<RiskDetail>(`/risks/${riskId}`, body, {
      headers: { 'If-Match': ifMatch },
    });
    return { risk: data, etag: resolveEtag(etag, data.version) };
  },

  async replaceCauses(
    riskId: string,
    items: readonly string[],
    ifMatch: string,
  ): Promise<{ items: readonly RiskStatement[]; etag: string }> {
    const { data, etag } = await apiClient.putWithMeta<RiskStatement[]>(
      `/risks/${riskId}/causes`,
      { items },
      { headers: { 'If-Match': ifMatch } },
    );
    return { items: data, etag: etag ?? ifMatch };
  },

  async replaceConsequences(
    riskId: string,
    items: readonly string[],
    ifMatch: string,
  ): Promise<{ items: readonly RiskStatement[]; etag: string }> {
    const { data, etag } = await apiClient.putWithMeta<RiskStatement[]>(
      `/risks/${riskId}/consequences`,
      { items },
      { headers: { 'If-Match': ifMatch } },
    );
    return { items: data, etag: etag ?? ifMatch };
  },

  /**
   * `GET /risk-methodology` (US4, FR-061, FR-069) — the active methodology
   * version, no additional permission beyond an authenticated session. The
   * assessment form and the Assessment section build their scales/matrix
   * from this response; neither ever hardcodes a 5×5 shape.
   */
  getActiveMethodology(): Promise<RiskMethodologyVersion> {
    return apiClient.get<RiskMethodologyVersion>('/risk-methodology');
  },

  /** `GET /risks/{riskId}/assessments` (US4, FR-066) — every assessment, newest first, each carrying its own `levelChange` relative to the one it superseded. Never fetches more than one page. */
  listAssessments(riskId: string, page: number, pageSize: number): Promise<Page<RiskAssessment>> {
    return apiClient.get<Page<RiskAssessment>>(
      `/risks/${riskId}/assessments?page=${page}&pageSize=${pageSize}`,
    );
  },

  /**
   * `POST /risks/{riskId}/assessments` (US4, FR-062 to FR-068, ADR-006).
   * `body` carries only factor values — see `CreateRiskAssessmentRequest`'s
   * own doc comment for why `inherentScore`/`inherentLevel`/`residualScore`/
   * `residualLevel` cannot even be expressed here. The response's `ETag`
   * reflects the RISK's new `version` (assessing repoints
   * `currentAssessmentId` and denormalized levels on the risk itself, in the
   * same transaction) — not a version of the assessment record, which is
   * immutable and never re-fetched with `If-Match`. Falls back to the
   * request's own `ifMatch` on the rare response with no `ETag` header,
   * exactly like `replaceCauses`/`replaceConsequences` above.
   */
  async createAssessment(
    riskId: string,
    body: CreateRiskAssessmentRequest,
    ifMatch: string,
  ): Promise<{ assessment: RiskAssessment; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskAssessment>(
      `/risks/${riskId}/assessments`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { assessment: data, etag: etag ?? ifMatch };
  },

  /** `GET /risk-categories` (no additional permission — reference data, FR-053). */
  listCategories: (): Promise<ReferenceDataItem[]> =>
    apiClient.get<ReferenceDataItem[]>('/risk-categories'),
  /** `GET /risk-types`. */
  listTypes: (): Promise<ReferenceDataItem[]> => apiClient.get<ReferenceDataItem[]>('/risk-types'),
  /** `GET /risk-origins`. */
  listOrigins: (): Promise<ReferenceDataItem[]> =>
    apiClient.get<ReferenceDataItem[]>('/risk-origins'),

  /** `GET /org-units` — already restricted to the caller's authorized scope by the server (FR-025b, FR-025c). */
  listOrgUnits: (): Promise<OrgUnitNode[]> => apiClient.get<OrgUnitNode[]>('/org-units'),

  // -------------------------------------------------------------------
  // Treatment (US5, T144-T145, FR-071 to FR-075)
  // -------------------------------------------------------------------

  /** `GET /risks/{riskId}/treatments` — every decision ever recorded, newest first, INCLUDING superseded ones (FR-073). */
  listTreatments(
    riskId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<RiskTreatmentDecision>> {
    return apiClient.get<Page<RiskTreatmentDecision>>(
      `/risks/${riskId}/treatments?page=${page}&pageSize=${pageSize}`,
    );
  },

  /**
   * `POST /risks/{riskId}/treatments` - records a new treatment decision.
   * Recording one SUPERSEDES the risk's previous current decision
   * server-side (FR-073); this call never edits an existing decision. The
   * response's `ETag` reflects the RISK's new `version` (repointing
   * `currentTreatmentId` is itself a mutation of the risk), like
   * `createAssessment` above.
   */
  async createTreatment(
    riskId: string,
    body: CreateRiskTreatmentDecisionRequest,
    ifMatch: string,
  ): Promise<{ decision: RiskTreatmentDecision; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskTreatmentDecision>(
      `/risks/${riskId}/treatments`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { decision: data, etag: etag ?? ifMatch };
  },

  /** `GET /risks/{riskId}/treatment-actions` - soonest-due first (no specific order is mandated by the contract; this is the order the server returns). */
  listTreatmentActions(
    riskId: string,
    page: number,
    pageSize: number,
    filters?: { status?: readonly TreatmentActionStatus[]; overdue?: boolean },
  ): Promise<Page<RiskTreatmentAction>> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (filters?.status && filters.status.length > 0) {
      params.set('status', filters.status.join(','));
    }
    if (filters?.overdue !== undefined) {
      params.set('overdue', String(filters.overdue));
    }
    return apiClient.get<Page<RiskTreatmentAction>>(
      `/risks/${riskId}/treatment-actions?${params.toString()}`,
    );
  },

  /** `POST /risks/{riskId}/treatment-actions`. */
  async createTreatmentAction(
    riskId: string,
    body: CreateRiskTreatmentActionRequest,
    ifMatch: string,
  ): Promise<{ action: RiskTreatmentAction; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskTreatmentAction>(
      `/risks/${riskId}/treatment-actions`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { action: data, etag: etag ?? ifMatch };
  },

  /**
   * `PATCH /risks/{riskId}/treatment-actions/{actionId}` - edits an action or
   * changes its status (FR-074a). `overdue` in the response is always
   * server-computed (ADR-015) - never derived from `dueOn`/`status` here.
   */
  async updateTreatmentAction(
    riskId: string,
    actionId: string,
    body: UpdateRiskTreatmentActionRequest,
    ifMatch: string,
  ): Promise<{ action: RiskTreatmentAction; etag: string }> {
    const { data, etag } = await apiClient.patchWithMeta<RiskTreatmentAction>(
      `/risks/${riskId}/treatment-actions/${actionId}`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { action: data, etag: etag ?? ifMatch };
  },

  // -------------------------------------------------------------------
  // Relationships - controls, processes, assets (US5, T146, FR-076 to FR-078)
  // -------------------------------------------------------------------

  /** `GET /risks/{riskId}/controls` - a plain array (not a paginated envelope), current links only unless `includeWithdrawn`. */
  listControlLinks(riskId: string, includeWithdrawn = false): Promise<readonly RiskControlLink[]> {
    return apiClient.get<readonly RiskControlLink[]>(
      `/risks/${riskId}/controls?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  /**
   * 013-incidents-problems-reverse-links — `GET /risks/{riskId}/incidents`,
   * READ-ONLY: `modules/risk` never writes `IncidentRiskLink` — the
   * Incident side owns that write path. Mirrors `listControlLinks` above.
   */
  listIncidentLinks(
    riskId: string,
    includeWithdrawn = false,
  ): Promise<readonly RiskIncidentLink[]> {
    return apiClient.get<readonly RiskIncidentLink[]>(
      `/risks/${riskId}/incidents?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  /**
   * 013-incidents-problems-reverse-links — `GET /risks/{riskId}/problems`,
   * READ-ONLY: `modules/risk` never writes `ProblemRiskLink` — the Problem
   * side owns that write path.
   */
  listProblemLinks(riskId: string, includeWithdrawn = false): Promise<readonly RiskProblemLink[]> {
    return apiClient.get<readonly RiskProblemLink[]>(
      `/risks/${riskId}/problems?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  async linkControl(
    riskId: string,
    body: LinkEntityRequest,
    ifMatch: string,
  ): Promise<{ link: RiskControlLink; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskControlLink>(
      `/risks/${riskId}/controls`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { link: data, etag: etag ?? ifMatch };
  },

  /** `DELETE /risks/{riskId}/controls/{linkId}` - withdraws the link (stamps `unlinkedBy`/`unlinkedAt`); the row and its history are retained, never deleted (FR-076, FR-102). */
  async unlinkControl(riskId: string, linkId: string, ifMatch: string): Promise<{ etag: string }> {
    const { etag } = await apiClient.deleteWithMeta<void>(`/risks/${riskId}/controls/${linkId}`, {
      headers: { 'If-Match': ifMatch },
    });
    return { etag: etag ?? ifMatch };
  },

  async linkProcess(
    riskId: string,
    body: LinkEntityRequest,
    ifMatch: string,
  ): Promise<{ link: RiskEntityLink; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskEntityLink>(
      `/risks/${riskId}/processes`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { link: data, etag: etag ?? ifMatch };
  },

  async unlinkProcess(riskId: string, linkId: string, ifMatch: string): Promise<{ etag: string }> {
    const { etag } = await apiClient.deleteWithMeta<void>(`/risks/${riskId}/processes/${linkId}`, {
      headers: { 'If-Match': ifMatch },
    });
    return { etag: etag ?? ifMatch };
  },

  async linkAsset(
    riskId: string,
    body: LinkEntityRequest,
    ifMatch: string,
  ): Promise<{ link: RiskEntityLink; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskEntityLink>(
      `/risks/${riskId}/assets`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { link: data, etag: etag ?? ifMatch };
  },

  async unlinkAsset(riskId: string, linkId: string, ifMatch: string): Promise<{ etag: string }> {
    const { etag } = await apiClient.deleteWithMeta<void>(`/risks/${riskId}/assets/${linkId}`, {
      headers: { 'If-Match': ifMatch },
    });
    return { etag: etag ?? ifMatch };
  },

  /**
   * `GET /controls` (platform.openapi.yaml) - the minimal control registry
   * a risk links against; `risk:view` only (FR-076). Front H: `q` now
   * genuinely reaches the server on every call (the picker searches live,
   * not just once on open) — the parameter always existed; only the
   * picker never exercised it. `isPartial` is computed from the SAME page
   * this endpoint already returns, never a second request — the point of
   * `SearchablePicker` is that this fixes itself once the caller searches,
   * never that this function fetches more rows to hide the boundary.
   */
  async listControls(q: string): Promise<RegistrySearchResult<RegistryItem>> {
    const page = await apiClient.get<Page<RegistryItem>>(
      `/controls?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  /**
   * `GET /processes` — moved to `processes.openapi.yaml`'s
   * `listProcessCatalog` in 006-assets-processes (Fase 4, T029/T030);
   * requires `process:view`, the resource's own permission, never
   * `risk:view` (FR-009). The HTTP path is unchanged (FR-014); this picker
   * only ever reads `id`/`code`/`name` from each row, all still present.
   */
  async listProcesses(q: string): Promise<RegistrySearchResult<RegistryItem>> {
    const page = await apiClient.get<Page<RegistryItem>>(
      `/processes?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  /** `GET /assets` — moved to `assets.openapi.yaml`'s `listAssetCatalog`
   * the same way; requires `asset:view`, never `risk:view` (FR-009). See
   * `listProcesses`'s own comment above for the full account. */
  async listAssets(q: string): Promise<RegistrySearchResult<RegistryItem>> {
    const page = await apiClient.get<Page<RegistryItem>>(
      `/assets?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  /**
   * `GET /users` — one endpoint, two different questions depending on
   * whether `assignableForOrgUnitId` is given. Never conflate the two: they
   * return different sets for the same caller.
   *
   * - Called with NO argument: the BROWSE listing, restricted to the
   *   CALLER's own organizational scope (FR-058) — the general-purpose
   *   directory lookup a filter/search control uses to look someone up.
   *   Scope only ever expands to descendants, never to ancestors, so this
   *   call can legitimately return few or even zero users for a narrowly
   *   scoped caller even though a perfectly good set of assignable people
   *   exists for a unit they can see — it must never back a REQUIRED
   *   owner/responsible picker.
   * - Called WITH `assignableForOrgUnitId`: the ASSIGNMENT listing for that
   *   specific organizational unit — users whose primary unit IS that unit,
   *   an ancestor of it, or a descendant of it, plus active users with no
   *   primary organizational unit. This is the call a REQUIRED
   *   owner/responsible picker must use, keyed to the unit currently
   *   selected in the form (never the caller's own scope) — see
   *   `RiskForm`'s handling of `orgUnitId`. Asking about a unit outside the
   *   caller's authorized scope is refused (`403`) indistinguishably from a
   *   nonexistent one (`404`).
   *
   * `q` searches either listing server-side (S-10: this project's own
   * development database already has more than 100 users — the fixed
   * `pageSize=100` this doc comment used to warn about, with no search,
   * silently hid every owner/responsible beyond the first page). `pageSize`
   * defaults to 20 (a picker's per-keystroke page); `RiskAuditSection`
   * passes 100 (the contract's own maximum, `list-directory-users-query
   * .dto.ts`) for its one-off, unsearched id→name lookup table instead —
   * still bounded, exactly as this call already was before this fix, never
   * a second, id-based endpoint this contract does not offer.
   */
  async searchUsers(
    q: string,
    assignableForOrgUnitId?: string,
    pageSize = 20,
  ): Promise<{ data: UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: String(pageSize) });
    if (q) params.set('q', q);
    if (assignableForOrgUnitId) {
      params.set('assignableForOrgUnitId', assignableForOrgUnitId);
    }
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: [...page.data], isPartial: page.data.length < page.meta.total };
  },

  // -------------------------------------------------------------------
  // Lifecycle and approvals (US6, T158-T162, FR-029/FR-029a-d, FR-079 to
  // FR-085, ADR-006)
  // -------------------------------------------------------------------

  /**
   * `GET /risks/{riskId}/lifecycle` (FR-080, FR-082) — the current state,
   * any pending-approval condition, and the transitions valid from here AND
   * permitted to this caller. `RiskLifecycleActions` renders exactly what
   * this returns; it never re-derives the transition table client-side
   * (ADR-006).
   */
  getLifecycle(riskId: string): Promise<RiskLifecycleState> {
    return apiClient.get<RiskLifecycleState>(`/risks/${riskId}/lifecycle`);
  },

  /**
   * `POST /risks/{riskId}/transitions` (FR-081, FR-083) — applies a
   * non-approval-gated transition immediately. The response's `ETag`
   * reflects the risk's new `version`.
   */
  async transitionRisk(
    riskId: string,
    body: TransitionRiskRequest,
    ifMatch: string,
  ): Promise<{ transition: RiskLifecycleTransition; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<RiskLifecycleTransition>(
      `/risks/${riskId}/transitions`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { transition: data, etag: etag ?? ifMatch };
  },

  /**
   * `POST /risks/{riskId}/approvals` (FR-029) — requests an approval-gated
   * transition into `ACCEPTED`/`CLOSED`. The risk stays in its current
   * lifecycle state (FR-029c); the response's `ETag` still reflects the
   * risk's current `version`, exactly like `linkControl`/`createTreatment`
   * above.
   */
  async requestApproval(
    riskId: string,
    body: RequestApprovalRequest,
    ifMatch: string,
  ): Promise<{ approval: Approval; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<Approval>(
      `/risks/${riskId}/approvals`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { approval: data, etag: etag ?? ifMatch };
  },

  /**
   * `POST /risks/{riskId}/approvals/{approvalId}/decision` (FR-029a to
   * FR-029c) — approves or rejects a pending approval. `APPROVED` applies
   * the requested transition server-side in the same write; the response's
   * `ETag` reflects the risk's new `version` either way.
   */
  async decideApproval(
    riskId: string,
    approvalId: string,
    body: ApprovalDecisionRequest,
    ifMatch: string,
  ): Promise<{ approval: Approval; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<Approval>(
      `/risks/${riskId}/approvals/${approvalId}/decision`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { approval: data, etag: etag ?? ifMatch };
  },

  // -------------------------------------------------------------------
  // History and audit (US7, T169-T171, FR-033 to FR-037, FR-105, ADR-007)
  // -------------------------------------------------------------------

  /**
   * `GET /risks/{riskId}/history` (FR-105) — a merged, chronological,
   * attributed account of assessments, treatment decisions, lifecycle
   * transitions, approvals and ownership changes, newest first. Available
   * to anyone who can see the risk (`risk:view`) — no additional
   * permission, unlike `listAuditEvents` below. `types` narrows to specific
   * entry kinds, mirroring the contract's own comma-separated `type` filter
   * (`style: form, explode: false`).
   */
  listHistory(
    riskId: string,
    page: number,
    pageSize: number,
    types?: readonly RiskHistoryEntryType[],
  ): Promise<Page<RiskHistoryEntry>> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (types && types.length > 0) {
      params.set('type', types.join(','));
    }
    return apiClient.get<Page<RiskHistoryEntry>>(`/risks/${riskId}/history?${params.toString()}`);
  },

  /**
   * `GET /risks/{riskId}/audit-events` (FR-033, FR-036) — the raw,
   * append-only audit trail for the risk and its child records. Requires
   * `risk:view` AND `audit:view`: a caller who can see the risk but lacks
   * `audit:view` receives `403` (the risk's existence is already known to
   * them, so the distinction discloses nothing, US7 AS4) — never the same
   * `404` `listHistory`/`getRisk` return for an out-of-scope risk.
   * `RiskAuditSection` is the only caller, and gates rendering on
   * `audit:view` client-side (advisory) while still handling a `403` from
   * this call gracefully if the server disagrees.
   */
  listAuditEvents(riskId: string, page: number, pageSize: number): Promise<Page<AuditEvent>> {
    return apiClient.get<Page<AuditEvent>>(
      `/risks/${riskId}/audit-events?page=${page}&pageSize=${pageSize}`,
    );
  },

  // -------------------------------------------------------------------
  // Comments and attachments (US9, T195, FR-095 to FR-100, FR-102, ADR-008)
  //
  // `platform.openapi.yaml`'s `/comments` and `/attachments` are generic,
  // keyed by `(entityType, entityId)` against the entity-type registry —
  // `entityType: 'RISK'` is fixed here because `risksApi` is the RISK
  // feature's own wrapper, not because the endpoints themselves are
  // risk-specific. A future module's own feature wrapper calls the same
  // two endpoints with its own `entityType` (ADR-008, FR-110); nothing
  // about `/comments`/`/attachments` needs to change for that to happen.
  // -------------------------------------------------------------------

  /** `GET /comments?entityType=RISK&entityId=...` — every comment on this risk, newest first. Withdrawn comments are already omitted server-side (FR-102). */
  listComments(riskId: string, page: number, pageSize: number): Promise<Page<Comment>> {
    return apiClient.get<Page<Comment>>(
      `/comments?entityType=RISK&entityId=${riskId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  /** `POST /comments` — requires `comment:create` plus `risk:view` (FR-098). The author/timestamp are taken from the session server-side, never sent here. */
  createComment(riskId: string, body: string): Promise<Comment> {
    return apiClient.post<Comment>('/comments', { entityType: 'RISK', entityId: riskId, body });
  },

  /** `DELETE /comments/{commentId}` — withdraws (never erases) the comment; attribution and the audit link are preserved (FR-102). */
  withdrawComment(commentId: string): Promise<void> {
    return apiClient.delete<void>(`/comments/${commentId}`);
  },

  /** `GET /attachments?entityType=RISK&entityId=...` — every attachment's metadata on this risk, newest first. Content is never fetched through this call — only `Attachment.contentUrl` (ADR-010). */
  listAttachments(riskId: string, page: number, pageSize: number): Promise<Page<Attachment>> {
    return apiClient.get<Page<Attachment>>(
      `/attachments?entityType=RISK&entityId=${riskId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  /**
   * `POST /attachments` (`multipart/form-data`) — requires
   * `attachment:create` plus `risk:view`. The server sniffs `file`'s actual
   * bytes and refuses (`422`) a mismatch with the declared content type, or
   * an excessive size (`413`) — both refusals arrive as `ApiError` with a
   * server-authored, already pt-BR `detail` (FR-097); this call never
   * pre-validates the file itself beyond what the browser's native
   * `accept` hint already does.
   */
  async uploadAttachment(riskId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.set('entityType', 'RISK');
    formData.set('entityId', riskId);
    formData.set('file', file);
    const { data } = await apiClient.postFormWithMeta<Attachment>('/attachments', formData);
    return data;
  },

  /** `DELETE /attachments/{attachmentId}` — withdraws (never erases) the attachment; uploader attribution and the audit link are preserved (FR-102). Subsequent content requests return `404`. */
  withdrawAttachment(attachmentId: string): Promise<void> {
    return apiClient.delete<void>(`/attachments/${attachmentId}`);
  },
};
