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

export interface WithEtag<T> {
  record: T;
  etag: string;
}

function resolveEtag(etag: string | null, version: number): string {
  return etag ?? `"${version}"`;
}

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

  listRequirements(
    frameworkId: string,
    versionId: string,
    query: RequirementListQuery,
  ): Promise<Page<Requirement>> {
    return apiClient.get<Page<Requirement>>(
      `/frameworks/${frameworkId}/versions/${versionId}/requirements?${buildRequirementListQueryString(query)}`,
    );
  },

  async getRequirement(requirementId: string): Promise<WithEtag<Requirement>> {
    const { data, etag } = await apiClient.getWithMeta<Requirement>(
      `/requirements/${requirementId}`,
    );
    return { record: data, etag: resolveEtag(etag, data.version) };
  },

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

  listRequirementControlLinks(
    requirementId: string,
    includeWithdrawn = false,
  ): Promise<readonly RequirementControlLink[]> {
    return apiClient.get<readonly RequirementControlLink[]>(
      `/requirements/${requirementId}/controls?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  linkRequirementToControl(
    requirementId: string,
    body: LinkRequirementControlRequest,
  ): Promise<RequirementControlLink> {
    return apiClient.post<RequirementControlLink>(`/requirements/${requirementId}/controls`, body);
  },

  unlinkRequirementFromControl(requirementId: string, linkId: string): Promise<void> {
    return apiClient.delete<void>(`/requirements/${requirementId}/controls/${linkId}`);
  },

  listRequirementApplicabilityDeclarations(
    requirementId: string,
    page = 1,
    pageSize = 25,
  ): Promise<Page<RequirementApplicability>> {
    return apiClient.get<Page<RequirementApplicability>>(
      `/requirements/${requirementId}/applicability-declarations?${buildPageQueryString(page, pageSize)}`,
    );
  },

  declareRequirementNotApplicable(
    requirementId: string,
    body: DeclareApplicabilityRequest,
  ): Promise<RequirementApplicability> {
    return apiClient.post<RequirementApplicability>(
      `/requirements/${requirementId}/applicability-declarations`,
      body,
    );
  },

  revokeRequirementApplicabilityDeclaration(
    requirementId: string,
    declarationId: string,
  ): Promise<void> {
    return apiClient.delete<void>(
      `/requirements/${requirementId}/applicability-declarations/${declarationId}`,
    );
  },

  getFrameworkVersionComplianceSummary(
    frameworkId: string,
    versionId: string,
  ): Promise<ComplianceSummary> {
    return apiClient.get<ComplianceSummary>(
      `/frameworks/${frameworkId}/versions/${versionId}/compliance-summary`,
    );
  },

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

  getMappingMigration(
    frameworkId: string,
    versionId: string,
    migrationId: string,
  ): Promise<MappingMigrationDetail> {
    return apiClient.get<MappingMigrationDetail>(
      `/frameworks/${frameworkId}/versions/${versionId}/mapping-migrations/${migrationId}`,
    );
  },

  async listControls(q: string): Promise<RegistrySearchResult<ControlRef>> {
    const page = await apiClient.get<Page<ControlRef>>(
      `/controls?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },
};
