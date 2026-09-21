/**
 * PharosGRC frontend — Audit Engagement API wrapper (T075, 005-audit-findings).
 *
 * A thin, typed layer over `apiClient` for the 13 `/audits/...` operations of
 * `specs/005-audit-findings/contracts/audit.openapi.yaml`, mirroring
 * `features/controls/api.ts`/`features/compliance/api.ts`'s own conventions.
 * The remaining 7 operations of that same contract are `/findings/...`-
 * scoped and live in `features/findings/api.ts` instead — see this module's
 * own `types.ts` header for the placement rule.
 *
 * Only `PATCH /audits/{auditId}` and the three lifecycle transitions
 * (`start`/`complete`/`cancel`) write to the versioned `audits` row and
 * require `If-Match` (research.md D-18 — `AuditEngagement` is a new root
 * entity and carries `version`/`ETag`/`If-Match` like every root entity
 * introduced since Controls Management). Every scope-link mutation below is
 * an independent, separately-keyed row that never carries `If-Match`,
 * exactly like `controlsApi`'s own assessment/attestation/link calls.
 */
import { apiClient } from '@/lib/api-client';

import type {
  AddControlScopeRequest,
  AddFrameworkVersionScopeRequest,
  AddRequirementScopeRequest,
  AuditEngagement,
  AuditEngagementFindingsQuery,
  AuditEngagementListQuery,
  AuditScopeEntry,
  CancelAuditEngagementRequest,
  ControlRef,
  CreateAuditEngagementRequest,
  CreateFindingFromEngagementRequest,
  FindingSummary,
  FrameworkRef,
  FrameworkVersionOption,
  OrgUnitNode,
  Page,
  RegistrySearchResult,
  RequirementOption,
  UpdateAuditEngagementRequest,
  UserRef,
} from './types';

/** A record together with the entity-tag its next mutation must echo in `If-Match` — mirrors `controlsApi`'s own `ControlWithVersion`/`complianceApi`'s own `WithEtag`. */
export interface AuditEngagementWithEtag {
  engagement: AuditEngagement;
  etag: string;
}

/** Falls back to a quoted `version` when a response genuinely carries no `ETag` header — mirrors `controlsApi`'s/`complianceApi`'s own `resolveEtag`. */
function resolveEtag(etag: string | null, version: number): string {
  return etag ?? `"${version}"`;
}

/** Builds `GET /audits`'s query string per its contract: every filter is a single value, never an array (unlike `GET /controls`), omitting any the caller did not set. */
function buildEngagementListQueryString(query: AuditEngagementListQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  if (query.orgUnitId) params.set('orgUnitId', query.orgUnitId);
  if (query.leadAuditorUserId) params.set('leadAuditorUserId', query.leadAuditorUserId);
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);
  return params.toString();
}

/** Builds `GET /audits/{auditId}/findings`'s query string. */
function buildEngagementFindingsQueryString(query: AuditEngagementFindingsQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  return params.toString();
}

export const auditEngagementsApi = {
  // -------------------------------------------------------------------
  // Engagement (operations 1-4, US1, FR-001 to FR-004)
  // -------------------------------------------------------------------

  /** `GET /audits` — the engagement catalog. Always paginated; never fetches more than one page. */
  listEngagements(query: AuditEngagementListQuery): Promise<Page<AuditEngagement>> {
    return apiClient.get<Page<AuditEngagement>>(`/audits?${buildEngagementListQueryString(query)}`);
  },

  async getEngagement(auditId: string): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.getWithMeta<AuditEngagement>(`/audits/${auditId}`);
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  async createEngagement(body: CreateAuditEngagementRequest): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.postWithMeta<AuditEngagement>('/audits', body);
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  /** `PATCH /audits/{auditId}` — permitted only while `status = PLANNING` (`422` otherwise, research.md D-3/D-13). */
  async updateEngagement(
    auditId: string,
    body: UpdateAuditEngagementRequest,
    ifMatch: string,
  ): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.patchWithMeta<AuditEngagement>(
      `/audits/${auditId}`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  // -------------------------------------------------------------------
  // Scope (operations 5-8, US1, FR-005/FR-006, ADR-020)
  // -------------------------------------------------------------------

  /** `GET /audits/{auditId}/scope` — the union of all three scope link kinds, newest first. Not paginated (research.md — bounded by what a human explicitly added). */
  listScope(auditId: string): Promise<readonly AuditScopeEntry[]> {
    return apiClient.get<readonly AuditScopeEntry[]>(`/audits/${auditId}/scope`);
  },

  /** `POST /audits/{auditId}/scope/framework-versions` — the version must be `PUBLISHED`; permitted only while `PLANNING`. No unlink operation exists for this link (research.md D-12). */
  addFrameworkVersionToScope(
    auditId: string,
    body: AddFrameworkVersionScopeRequest,
  ): Promise<AuditScopeEntry> {
    return apiClient.post<AuditScopeEntry>(`/audits/${auditId}/scope/framework-versions`, body);
  },

  /** `POST /audits/{auditId}/scope/requirements` — the requirement's own framework version must be `PUBLISHED`. */
  addRequirementToScope(
    auditId: string,
    body: AddRequirementScopeRequest,
  ): Promise<AuditScopeEntry> {
    return apiClient.post<AuditScopeEntry>(`/audits/${auditId}/scope/requirements`, body);
  },

  /** `POST /audits/{auditId}/scope/controls` — the control must be `ACTIVE` and within the caller's organizational scope (ADR-020 part 4). */
  addControlToScope(auditId: string, body: AddControlScopeRequest): Promise<AuditScopeEntry> {
    return apiClient.post<AuditScopeEntry>(`/audits/${auditId}/scope/controls`, body);
  },

  // -------------------------------------------------------------------
  // Lifecycle (operations 9-11, FR-002 to FR-004a, research.md D-3)
  // -------------------------------------------------------------------

  /** `POST /audits/{auditId}/start` — `PLANNING -> IN_PROGRESS`. Refused with `422` when the engagement has no scope link of any kind (FR-003). */
  async startEngagement(auditId: string, ifMatch: string): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.postWithMeta<AuditEngagement>(
      `/audits/${auditId}/start`,
      undefined,
      { headers: { 'If-Match': ifMatch } },
    );
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  /** `POST /audits/{auditId}/complete` — `IN_PROGRESS -> COMPLETED`, terminal. */
  async completeEngagement(auditId: string, ifMatch: string): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.postWithMeta<AuditEngagement>(
      `/audits/${auditId}/complete`,
      undefined,
      { headers: { 'If-Match': ifMatch } },
    );
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  /** `POST /audits/{auditId}/cancel` (FR-004a) — `PLANNING`/`IN_PROGRESS` -> `CANCELLED`, terminal. Requires a non-empty `justification`. */
  async cancelEngagement(
    auditId: string,
    body: CancelAuditEngagementRequest,
    ifMatch: string,
  ): Promise<AuditEngagementWithEtag> {
    const { data, etag } = await apiClient.postWithMeta<AuditEngagement>(
      `/audits/${auditId}/cancel`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { engagement: data, etag: resolveEtag(etag, data.version) };
  },

  // -------------------------------------------------------------------
  // Findings from this engagement (operations 12-13, US2, FR-007/FR-008)
  // -------------------------------------------------------------------

  /** `GET /audits/{auditId}/findings` — the findings this engagement produced, newest first. `finding:view` is NOT additionally required — the engagement's own scope already gates visibility. */
  listEngagementFindings(
    auditId: string,
    query: AuditEngagementFindingsQuery,
  ): Promise<Page<FindingSummary>> {
    return apiClient.get<Page<FindingSummary>>(
      `/audits/${auditId}/findings?${buildEngagementFindingsQueryString(query)}`,
    );
  },

  /** `POST /audits/{auditId}/findings` — permitted only while `IN_PROGRESS` (FR-007). `orgUnitId` is never accepted here — derived server-side from the engagement's own `orgUnitId`. No `If-Match`: this creates a new, independently-keyed `Finding` row, never writes to `audits.version`. */
  createEngagementFinding(
    auditId: string,
    body: CreateFindingFromEngagementRequest,
  ): Promise<FindingSummary> {
    return apiClient.post<FindingSummary>(`/audits/${auditId}/findings`, body);
  },

  // -------------------------------------------------------------------
  // Reference data (T076) — the same `/org-units`/`/users` endpoints
  // `controlsApi`/`risksApi` already wrap, each module keeping its own thin
  // copy per this file's own header comment (CLAUDE.md §2, §4). The lead
  // auditor picker uses the plain browse listing, never an org-unit-scoped
  // ASSIGNMENT listing: `CreateAuditEngagementUseCase.assertLeadAuditorAssignable`
  // (apps/api) only requires the chosen user to be active — no organizational
  // relationship to the engagement's own unit is enforced server-side, unlike
  // `controlsApi`'s/`risksApi`'s owner pickers.
  // -------------------------------------------------------------------

  /** `GET /org-units` — already restricted to the caller's authorized scope by the server. */
  listOrgUnits(): Promise<OrgUnitNode[]> {
    return apiClient.get<OrgUnitNode[]>('/org-units');
  },

  /**
   * `GET /users?q=` — the plain browse listing (no `assignableForOrgUnitId`;
   * see this section's own header comment for why), now searched
   * server-side (S-10: a fixed `pageSize=100` with no search silently hid
   * every lead auditor/owner beyond the first page).
   */
  async searchUsers(q: string): Promise<{ data: readonly UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  // -------------------------------------------------------------------
  // Scope pickers' reference data (T076, US1, FR-005/FR-006, ADR-020) —
  // this contract has no flat, cross-framework `/framework-versions` or
  // `/requirements` endpoint, so the "Versão de framework" and "Requisito"
  // scope variants walk framework -> version -> (requirement) exactly like
  // a human browsing the normative library would, mirroring
  // `complianceApi`'s own listing shape one level at a time rather than
  // importing across the module boundary (CLAUDE.md §2, §4). Gated by
  // `compliance:view` server-side, the same cross-module reference-data
  // read `complianceApi.listControls` itself already requires `control:view`
  // for (ADR-020) — reading another module's catalog to populate a picker
  // is the explicitly declared relationship, never a hidden coupling.
  // -------------------------------------------------------------------

  /** `GET /frameworks` — every framework the caller may read, for the scope form's first cascading step. Capped at 100; the normative library is an organization-wide catalog, not a 50,000-row scale. */
  async listFrameworks(): Promise<readonly FrameworkRef[]> {
    const page = await apiClient.get<Page<FrameworkRef>>('/frameworks?pageSize=100');
    return page.data;
  },

  /** `GET /frameworks/{frameworkId}/versions?status=PUBLISHED` — only published versions are ever offered to the scope form (FR-006, research.md D-2: a draft version's requirements are never scopeable, and `addFrameworkVersionToScope`/`addRequirementToScope` both reject a non-published version with `422`). */
  async listPublishedFrameworkVersions(
    frameworkId: string,
  ): Promise<readonly FrameworkVersionOption[]> {
    const page = await apiClient.get<Page<FrameworkVersionOption>>(
      `/frameworks/${frameworkId}/versions?status=PUBLISHED&pageSize=100`,
    );
    return page.data;
  },

  /** `GET /frameworks/{frameworkId}/versions/{versionId}/requirements` — the scope form's requirement picker, for a framework version already confirmed `PUBLISHED` by the picker's own preceding step. */
  async listRequirements(
    frameworkId: string,
    versionId: string,
  ): Promise<readonly RequirementOption[]> {
    const page = await apiClient.get<Page<RequirementOption>>(
      `/frameworks/${frameworkId}/versions/${versionId}/requirements?pageSize=100`,
    );
    return page.data;
  },

  /** `GET /controls?q=` — the same flat, searched-on-open catalog lookup `complianceApi.listControls` already wraps for its own control-mapping picker; the actual scope-link attempt is still re-checked server-side against status/organizational scope (ADR-020, FR-022). */
  async listControls(q: string): Promise<RegistrySearchResult<ControlRef>> {
    const page = await apiClient.get<Page<ControlRef>>(
      `/controls?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },
};
