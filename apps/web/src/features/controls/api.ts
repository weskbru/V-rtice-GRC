/**
 * PharosGRC frontend — Controls Management API wrapper (T044).
 *
 * A thin, typed layer over `apiClient` for the control endpoints this
 * module uses, mirroring `features/risks/api.ts`'s own conventions.
 *
 * Only `PATCH /controls/{controlId}` and `POST /controls/{controlId}/transitions`
 * write directly to the versioned `controls` row and require `If-Match`
 * (the contract's own "Optimistic locking is scoped to the control's own
 * row" clause) — every other mutation here (assessments, attestations,
 * process/asset links) is an independent, separately-keyed row that never
 * carries `If-Match`, unlike the equivalent risk-side calls in
 * `risksApi`.
 */
import { apiClient } from '@/lib/api-client';

import type {
  ControlAssessment,
  ControlAssessmentAttestation,
  ControlAssessmentAttestationDecisionRequest,
  ControlAssetLink,
  ControlDetail,
  ControlLifecycleState,
  ControlLifecycleTransition,
  ControlProcessLink,
  ControlRegisterQuery,
  ControlRiskLink,
  ControlSummary,
  CreateControlAssessmentRequest,
  CreateControlRequest,
  LinkEntityRequest,
  OrgUnitNode,
  Page,
  RegistryItem,
  RegistrySearchResult,
  TransitionControlRequest,
  UpdateControlRequest,
  UserRef,
} from './types';
import type { Action, ActionOriginType } from '@/features/actions/types';

/** A control together with the entity-tag its next mutation must echo in `If-Match`. */
export interface ControlWithVersion {
  control: ControlDetail;
  etag: string;
}

/** Falls back to a quoted `version` when a response genuinely carries no `ETag` header — mirrors `risksApi`'s own `resolveEtag`. */
function resolveEtag(etag: string | null, version: number): string {
  return etag ?? `"${version}"`;
}

/** Builds `GET /controls`'s query string exactly per its contract: comma-separated arrays (`style: form, explode: false`), omitting any filter the caller did not set. */
function buildRegisterQueryString(query: ControlRegisterQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.status && query.status.length > 0) params.set('status', query.status.join(','));
  if (query.effectiveness && query.effectiveness.length > 0)
    params.set('effectiveness', query.effectiveness.join(','));
  if (query.nature && query.nature.length > 0) params.set('nature', query.nature.join(','));
  if (query.type && query.type.length > 0) params.set('type', query.type.join(','));
  if (query.frequency && query.frequency.length > 0)
    params.set('frequency', query.frequency.join(','));
  if (query.orgUnitId && query.orgUnitId.length > 0)
    params.set('orgUnitId', query.orgUnitId.join(','));
  if (query.ownerUserId && query.ownerUserId.length > 0)
    params.set('ownerUserId', query.ownerUserId.join(','));
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);
  return params.toString();
}

export const controlsApi = {
  /** `GET /controls` — the control catalog (FR-001 to FR-008). Always paginated; never fetches more than one page. */
  listCatalog(query: ControlRegisterQuery): Promise<Page<ControlSummary>> {
    return apiClient.get<Page<ControlSummary>>(`/controls?${buildRegisterQueryString(query)}`);
  },

  async getControl(controlId: string): Promise<ControlWithVersion> {
    const { data, etag } = await apiClient.getWithMeta<ControlDetail>(`/controls/${controlId}`);
    return { control: data, etag: resolveEtag(etag, data.version) };
  },

  async createControl(body: CreateControlRequest): Promise<ControlWithVersion> {
    const { data, etag } = await apiClient.postWithMeta<ControlDetail>('/controls', body);
    return { control: data, etag: resolveEtag(etag, data.version) };
  },

  async updateControl(
    controlId: string,
    body: UpdateControlRequest,
    ifMatch: string,
  ): Promise<ControlWithVersion> {
    const { data, etag } = await apiClient.patchWithMeta<ControlDetail>(
      `/controls/${controlId}`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { control: data, etag: resolveEtag(etag, data.version) };
  },

  /** `GET /controls/{controlId}/lifecycle` (D-6) — current state and the transitions valid from it AND permitted to this caller. */
  getLifecycle(controlId: string): Promise<ControlLifecycleState> {
    return apiClient.get<ControlLifecycleState>(`/controls/${controlId}/lifecycle`);
  },

  /** `POST /controls/{controlId}/transitions` — applies a lifecycle transition. The response's `ETag` reflects the control's new `version`. */
  async transitionControl(
    controlId: string,
    body: TransitionControlRequest,
    ifMatch: string,
  ): Promise<{ transition: ControlLifecycleTransition; etag: string }> {
    const { data, etag } = await apiClient.postWithMeta<ControlLifecycleTransition>(
      `/controls/${controlId}/transitions`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { transition: data, etag: etag ?? ifMatch };
  },

  // -------------------------------------------------------------------
  // Assessments and attestation (US2, FR-009 to FR-020)
  // -------------------------------------------------------------------

  /** `GET /controls/{controlId}/assessments` — every assessment ever recorded, newest first. Never fetches more than one page. */
  listAssessments(
    controlId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<ControlAssessment>> {
    return apiClient.get<Page<ControlAssessment>>(
      `/controls/${controlId}/assessments?page=${page}&pageSize=${pageSize}`,
    );
  },

  /**
   * `POST /controls/{controlId}/assessments` (FR-009 to FR-011). No
   * `If-Match`: this is a new, independently-keyed row and does not write
   * to `controls.version`. The assessor is taken from the session and is
   * never sent here.
   */
  createAssessment(
    controlId: string,
    body: CreateControlAssessmentRequest,
  ): Promise<ControlAssessment> {
    return apiClient.post<ControlAssessment>(`/controls/${controlId}/assessments`, body);
  },

  /** `POST /controls/{controlId}/assessments/{assessmentId}/attestation` — opens a pending attestation. No request body. */
  requestAttestation(
    controlId: string,
    assessmentId: string,
  ): Promise<ControlAssessmentAttestation> {
    return apiClient.post<ControlAssessmentAttestation>(
      `/controls/${controlId}/assessments/${assessmentId}/attestation`,
    );
  },

  /**
   * `POST /controls/{controlId}/assessments/{assessmentId}/attestation/decision`
   * — approve or reject. Two independent segregation-of-duties rules are
   * enforced server-side (C1: not the assessor; C2: not the control's
   * owner) — this call never pre-validates either, it only surfaces the
   * server's own refusal (`ApiError.problem.detail`, already pt-BR).
   */
  decideAttestation(
    controlId: string,
    assessmentId: string,
    body: ControlAssessmentAttestationDecisionRequest,
  ): Promise<ControlAssessmentAttestation> {
    return apiClient.post<ControlAssessmentAttestation>(
      `/controls/${controlId}/assessments/${assessmentId}/attestation/decision`,
      body,
    );
  },

  // -------------------------------------------------------------------
  // Relationships — risks (read-only), processes, assets (US3, FR-021 to
  // FR-025, ADR-020)
  // -------------------------------------------------------------------

  /** `GET /controls/{controlId}/risks` — read-only by design (FR-021): `RiskControlLink` is owned by the Risk module and is created/withdrawn only from the risk side. */
  listRiskLinks(controlId: string, includeWithdrawn = false): Promise<readonly ControlRiskLink[]> {
    return apiClient.get<readonly ControlRiskLink[]>(
      `/controls/${controlId}/risks?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  listProcessLinks(
    controlId: string,
    includeWithdrawn = false,
  ): Promise<readonly ControlProcessLink[]> {
    return apiClient.get<readonly ControlProcessLink[]>(
      `/controls/${controlId}/processes?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkProcess(controlId: string, body: LinkEntityRequest): Promise<ControlProcessLink> {
    return apiClient.post<ControlProcessLink>(`/controls/${controlId}/processes`, body);
  },

  unlinkProcess(controlId: string, linkId: string): Promise<void> {
    return apiClient.delete<void>(`/controls/${controlId}/processes/${linkId}`);
  },

  listAssetLinks(
    controlId: string,
    includeWithdrawn = false,
  ): Promise<readonly ControlAssetLink[]> {
    return apiClient.get<readonly ControlAssetLink[]>(
      `/controls/${controlId}/assets?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkAsset(controlId: string, body: LinkEntityRequest): Promise<ControlAssetLink> {
    return apiClient.post<ControlAssetLink>(`/controls/${controlId}/assets`, body);
  },

  unlinkAsset(controlId: string, linkId: string): Promise<void> {
    return apiClient.delete<void>(`/controls/${controlId}/assets/${linkId}`);
  },

  // -------------------------------------------------------------------
  // Reference data
  // -------------------------------------------------------------------

  /** `GET /org-units` — already restricted to the caller's authorized scope by the server. */
  listOrgUnits: (): Promise<OrgUnitNode[]> => apiClient.get<OrgUnitNode[]>('/org-units'),

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
   * `GET /users?q=` — two different questions depending on
   * `assignableForOrgUnitId`. See `risksApi.searchUsers`'s own doc comment
   * for the full explanation this mirrors exactly: called with NO
   * `assignableForOrgUnitId`, the BROWSE listing restricted to the
   * CALLER's own scope (a filter/search lookup, never a required picker's
   * source); called WITH it, the ASSIGNMENT listing for that unit — the
   * one a REQUIRED owner picker must use, keyed to the unit currently
   * selected in the form. `q` searches server-side either way (S-10: a
   * fixed `pageSize=100` with no search silently hid every owner beyond
   * the first page — this is the one owner picker in the product that also
   * needs to preserve `assignableForOrgUnitId`'s organizational-scope
   * restriction while doing it).
   */
  async searchUsers(
    q: string,
    assignableForOrgUnitId?: string,
  ): Promise<{ data: UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    if (assignableForOrgUnitId) {
      params.set('assignableForOrgUnitId', assignableForOrgUnitId);
    }
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: [...page.data], isPartial: page.data.length < page.meta.total };
  },

  // -------------------------------------------------------------------
  // Remediation actions opened from an ineffective assessment (FR-027) —
  // the shared `Action` capability (§17), consumed here exactly as
  // `data-model.md`'s Assumptions describe: no second task system.
  // -------------------------------------------------------------------

  /** `GET /actions?originType=CONTROL_ASSESSMENT&originId=...` — the remediation actions opened from one assessment. */
  async listAssessmentActions(assessmentId: string): Promise<readonly Action[]> {
    const page = await apiClient.get<{ items: readonly Action[] }>(
      `/actions?page=1&pageSize=25&originType=CONTROL_ASSESSMENT&originId=${assessmentId}`,
    );
    return page.items;
  },

  /** `POST /actions` — opens a remediation action from an ineffective/partially-effective assessment (FR-027, US3 AS7). */
  createAssessmentAction(
    assessmentId: string,
    body: { title: string; description?: string; responsibleUserId: string; dueOn: string },
  ): Promise<Action> {
    const originType: ActionOriginType = 'CONTROL_ASSESSMENT';
    return apiClient.post<Action>('/actions', { ...body, originType, originId: assessmentId });
  },
};
