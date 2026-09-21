/**
 * PharosGRC frontend — Compliance API wrapper (004-compliance-management).
 *
 * A thin, typed layer over `apiClient` for all 23 contract operations —
 * the normative library, requirement↔control mapping, applicability
 * declaration, mapping migration and the compliance summary. Mirrors
 * `features/controls/api.ts`'s own conventions.
 *
 * `Framework`, `FrameworkVersion` and `Requirement` each carry their own
 * optimistic-locking `version`; every `PATCH` and `publish` call requires
 * `If-Match` and returns the new `ETag` alongside the updated record,
 * exactly like `controlsApi`. Requirement-control links and applicability
 * declarations are independent, separately-keyed rows that never write to
 * a root entity's `version` column (the contract's own "Optimistic locking
 * is scoped to each root entity's own row" clause) — none of the calls
 * below that create or withdraw them carries `If-Match`.
 */
import { apiClient } from '@/lib/api-client';

import type {
  ComplianceSummary,
  ControlRef,
  CreateFrameworkRequest,
  CreateFrameworkVersionRequest,
  CreateRequirementRequest,
  DeclareApplicabilityRequest,
  ExecuteMappingMigrationRequest,
  Framework,
  FrameworkListQuery,
  FrameworkVersion,
  FrameworkVersionListQuery,
  LinkRequirementControlRequest,
  MappingMigrationDetail,
  MappingMigrationSummary,
  Page,
  RegistrySearchResult,
  Requirement,
  RequirementApplicability,
  RequirementControlLink,
  RequirementListQuery,
  UpdateFrameworkRequest,
  UpdateFrameworkVersionRequest,
  UpdateRequirementRequest,
} from './types';

/** A record together with the entity-tag its next mutation must echo in `If-Match`. */
export interface WithEtag<T> {
  record: T;
  etag: string;
}

/** Falls back to a quoted `version` when a response genuinely carries no `ETag` header — mirrors `controlsApi`'s own `resolveEtag`. */
function resolveEtag(etag: string | null, version: number): string {
  return etag ?? `"${version}"`;
}

/** Builds `GET /frameworks`'s query string per its contract: comma-separated arrays (`style: form, explode: false`), omitting any filter the caller did not set. */
function buildFrameworkListQueryString(query: FrameworkListQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.q) params.set('q', query.q);
  if (query.origin && query.origin.length > 0) params.set('origin', query.origin.join(','));
  if (query.sort) params.set('sort', query.sort);
  if (query.direction) params.set('direction', query.direction);
  return params.toString();
}

function buildVersionListQueryString(query: FrameworkVersionListQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.status && query.status.length > 0) params.set('status', query.status.join(','));
  return params.toString();
}

function buildRequirementListQueryString(query: RequirementListQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.complianceState && query.complianceState.length > 0) {
    params.set('complianceState', query.complianceState.join(','));
  }
  return params.toString();
}

function buildPageQueryString(page: number, pageSize: number): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return params.toString();
}

export const complianceApi = {
  // -------------------------------------------------------------------
  // Frameworks (operations 1-4, US1)
  // -------------------------------------------------------------------

  listFrameworks(query: FrameworkListQuery): Promise<Page<Framework>> {
    return apiClient.get<Page<Framework>>(`/frameworks?${buildFrameworkListQueryString(query)}`);
  },

  async getFramework(frameworkId: string): Promise<WithEtag<Framework>> {
    const { data, etag } = await apiClient.getWithMeta<Framework>(`/frameworks/${frameworkId}`);
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

  async createFramework(body: CreateFrameworkRequest): Promise<WithEtag<Framework>> {
    const { data, etag } = await apiClient.postWithMeta<Framework>('/frameworks', body);
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

  async updateFramework(
    frameworkId: string,
    body: UpdateFrameworkRequest,
    ifMatch: string,
  ): Promise<WithEtag<Framework>> {
    const { data, etag } = await apiClient.patchWithMeta<Framework>(
      `/frameworks/${frameworkId}`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

  // -------------------------------------------------------------------
  // Framework versions (operations 5-9, US1)
  // -------------------------------------------------------------------

  listFrameworkVersions(
    frameworkId: string,
    query: FrameworkVersionListQuery,
  ): Promise<Page<FrameworkVersion>> {
    return apiClient.get<Page<FrameworkVersion>>(
      `/frameworks/${frameworkId}/versions?${buildVersionListQueryString(query)}`,
    );
  },

  async getFrameworkVersion(
    frameworkId: string,
    versionId: string,
  ): Promise<WithEtag<FrameworkVersion>> {
    const { data, etag } = await apiClient.getWithMeta<FrameworkVersion>(
      `/frameworks/${frameworkId}/versions/${versionId}`,
    );
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

  async createFrameworkVersion(
    frameworkId: string,
    body: CreateFrameworkVersionRequest,
  ): Promise<WithEtag<FrameworkVersion>> {
    const { data, etag } = await apiClient.postWithMeta<FrameworkVersion>(
      `/frameworks/${frameworkId}/versions`,
      body,
    );
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

  async updateFrameworkVersion(
    frameworkId: string,
    versionId: string,
    body: UpdateFrameworkVersionRequest,
    ifMatch: string,
  ): Promise<WithEtag<FrameworkVersion>> {
    const { data, etag } = await apiClient.patchWithMeta<FrameworkVersion>(
      `/frameworks/${frameworkId}/versions/${versionId}`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

  /** `POST /frameworks/{frameworkId}/versions/{versionId}/publish` — FR-005, one-way (research.md D-3). Refused with `422` when the version has no requirement, surfaced honestly rather than pre-guessed client-side (this phase has no way to count requirements — see the module doc comment in `features/compliance/types.ts`). */
  async publishFrameworkVersion(
    frameworkId: string,
    versionId: string,
    ifMatch: string,
  ): Promise<WithEtag<FrameworkVersion>> {
    const { data, etag } = await apiClient.postWithMeta<FrameworkVersion>(
      `/frameworks/${frameworkId}/versions/${versionId}/publish`,
      undefined,
      { headers: { 'If-Match': ifMatch } },
    );
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

  // -------------------------------------------------------------------
  // Requirements (operations 10-13, US1).
  // -------------------------------------------------------------------

  /** `GET .../versions/{versionId}/requirements` — ordered by `externalRef` by default (operation 10). Each row carries a freshly computed `complianceState` (research.md D-8). */
  listRequirements(
    frameworkId: string,
    versionId: string,
    query: RequirementListQuery,
  ): Promise<Page<Requirement>> {
    return apiClient.get<Page<Requirement>>(
      `/frameworks/${frameworkId}/versions/${versionId}/requirements?${buildRequirementListQueryString(query)}`,
    );
  },

  /** `GET /requirements/{requirementId}` — `complianceState` is freshly computed on every call (operation 12). */
  async getRequirement(requirementId: string): Promise<WithEtag<Requirement>> {
    const { data, etag } = await apiClient.getWithMeta<Requirement>(
      `/requirements/${requirementId}`,
    );
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

  /** `POST /frameworks/{frameworkId}/versions/{versionId}/requirements` — permitted only while the version is `DRAFT` (FR-004), refused with `422` once `PUBLISHED`. */
  async createRequirement(
    frameworkId: string,
    versionId: string,
    body: CreateRequirementRequest,
  ): Promise<WithEtag<Requirement>> {
    const { data, etag } = await apiClient.postWithMeta<Requirement>(
      `/frameworks/${frameworkId}/versions/${versionId}/requirements`,
      body,
    );
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

  /** `PATCH /requirements/{requirementId}` — refused with `422` once the parent version is `PUBLISHED` (FR-004), enforced by a database trigger the API surfaces as a domain error. */
  async updateRequirement(
    requirementId: string,
    body: UpdateRequirementRequest,
    ifMatch: string,
  ): Promise<WithEtag<Requirement>> {
    const { data, etag } = await apiClient.patchWithMeta<Requirement>(
      `/requirements/${requirementId}`,
      body,
      { headers: { 'If-Match': ifMatch } },
    );
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

  // -------------------------------------------------------------------
  // Requirement-control mapping (operations 14-15, US2, ADR-020).
  // -------------------------------------------------------------------

  /** `GET /requirements/{requirementId}/controls` — a plain array, current links only unless `includeWithdrawn` (FR-011). */
  listRequirementControlLinks(
    requirementId: string,
    includeWithdrawn = false,
  ): Promise<readonly RequirementControlLink[]> {
    return apiClient.get<readonly RequirementControlLink[]>(
      `/requirements/${requirementId}/controls?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  /**
   * `POST /requirements/{requirementId}/controls` — requires `compliance:map`
   * on the requirement AND the control to lie inside the caller's
   * organizational scope (ADR-020). A control that does not exist, and one
   * that lies outside scope, both answer `422` — deliberately
   * indistinguishable (FR-022) — never `404`. Does not carry `If-Match`.
   */
  linkRequirementToControl(
    requirementId: string,
    body: LinkRequirementControlRequest,
  ): Promise<RequirementControlLink> {
    return apiClient.post<RequirementControlLink>(`/requirements/${requirementId}/controls`, body);
  },

  /** `DELETE /requirements/{requirementId}/controls/{linkId}` — withdraws the link (stamps `unlinkedBy`/`unlinkedAt`); the row is preserved, never deleted (FR-011). */
  unlinkRequirementFromControl(requirementId: string, linkId: string): Promise<void> {
    return apiClient.delete<void>(`/requirements/${requirementId}/controls/${linkId}`);
  },

  // -------------------------------------------------------------------
  // Applicability declaration (operations 16-17, US3, FR-015/FR-016).
  // -------------------------------------------------------------------

  /** `GET /requirements/{requirementId}/applicability-declarations` — every declaration, current and revoked, newest first (data-model.md §6). */
  listRequirementApplicabilityDeclarations(
    requirementId: string,
    page = 1,
    pageSize = 25,
  ): Promise<Page<RequirementApplicability>> {
    return apiClient.get<Page<RequirementApplicability>>(
      `/requirements/${requirementId}/applicability-declarations?${buildPageQueryString(page, pageSize)}`,
    );
  },

  /** `POST /requirements/{requirementId}/applicability-declarations` — `justification` required (FR-015); refused with `409` when a declaration is already active. */
  declareRequirementNotApplicable(
    requirementId: string,
    body: DeclareApplicabilityRequest,
  ): Promise<RequirementApplicability> {
    return apiClient.post<RequirementApplicability>(
      `/requirements/${requirementId}/applicability-declarations`,
      body,
    );
  },

  /** `DELETE /requirements/{requirementId}/applicability-declarations/{declarationId}` — revokes the active declaration; the row is preserved (research.md D-7). */
  revokeRequirementApplicabilityDeclaration(
    requirementId: string,
    declarationId: string,
  ): Promise<void> {
    return apiClient.delete<void>(
      `/requirements/${requirementId}/applicability-declarations/${declarationId}`,
    );
  },

  // -------------------------------------------------------------------
  // Compliance summary (operation 18, US3, FR-020).
  // -------------------------------------------------------------------

  /** `GET .../versions/{versionId}/compliance-summary` — the aggregate compliance state of the version's applicable requirements. Never cached; recomputed on every call. */
  getFrameworkVersionComplianceSummary(
    frameworkId: string,
    versionId: string,
  ): Promise<ComplianceSummary> {
    return apiClient.get<ComplianceSummary>(
      `/frameworks/${frameworkId}/versions/${versionId}/compliance-summary`,
    );
  },

  // -------------------------------------------------------------------
  // Mapping migration (operations 19-20, US2, FR-012 to FR-014).
  // -------------------------------------------------------------------

  /** `GET .../versions/{versionId}/mapping-migrations` — newest first by `executedAt`; each entry is a summary. */
  listMappingMigrations(
    frameworkId: string,
    versionId: string,
    page = 1,
    pageSize = 25,
  ): Promise<Page<MappingMigrationSummary>> {
    return apiClient.get<Page<MappingMigrationSummary>>(
      `/frameworks/${frameworkId}/versions/${versionId}/mapping-migrations?${buildPageQueryString(page, pageSize)}`,
    );
  },

  /**
   * `POST .../versions/{versionId}/mapping-migrations` — carries the
   * compliance manager's own decided correspondences exactly as supplied;
   * never infers one (research.md D-6). Re-runnable: a target already
   * decided (by a prior run or by hand) is skipped, never overwritten
   * (FR-014).
   */
  executeMappingMigration(
    frameworkId: string,
    versionId: string,
    body: ExecuteMappingMigrationRequest,
  ): Promise<MappingMigrationDetail> {
    return apiClient.post<MappingMigrationDetail>(
      `/frameworks/${frameworkId}/versions/${versionId}/mapping-migrations`,
      body,
    );
  },

  /** `GET .../mapping-migrations/{migrationId}` — the full per-requirement detail of one execution (SC-004). Immutable once recorded. */
  getMappingMigration(
    frameworkId: string,
    versionId: string,
    migrationId: string,
  ): Promise<MappingMigrationDetail> {
    return apiClient.get<MappingMigrationDetail>(
      `/frameworks/${frameworkId}/versions/${versionId}/mapping-migrations/${migrationId}`,
    );
  },

  // -------------------------------------------------------------------
  // Cross-module registry lookup — the control picker (ADR-020).
  // -------------------------------------------------------------------

  /**
   * `GET /controls` (platform.openapi.yaml) — the minimal control registry
   * this module's requirement-control picker searches against, mirroring
   * `risksApi.listControls`'s own convention. `control:view`, not
   * `compliance:*` — this reads Controls' own catalog, not compliance data;
   * the actual link attempt is still re-checked server-side against the
   * caller's organizational scope (ADR-020, FR-022).
   */
  async listControls(q: string): Promise<RegistrySearchResult<ControlRef>> {
    const page = await apiClient.get<Page<ControlRef>>(
      `/controls?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },
};
