/**
 * T180 — maps `DetailedOrgScopeGrantRecord` to
 * `contracts/admin.openapi.yaml`'s `OrgScopeGrant` response schema.
 */
import type { DetailedOrgScopeGrantRecord } from '../../domain/ports/org-scope-repository.port';

export interface OrgUnitRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface OrgScopeGrantResponse {
  readonly id: string;
  readonly scopeType: string;
  readonly orgUnit: OrgUnitRefResponse | null;
  readonly grantedBy: UserRefResponse;
  readonly grantedAt: string;
}

export function toOrgScopeGrantResponse(grant: DetailedOrgScopeGrantRecord): OrgScopeGrantResponse {
  return {
    id: grant.id,
    scopeType: grant.scopeType,
    orgUnit: grant.orgUnit ?? null,
    grantedBy: grant.grantedBy,
    grantedAt: grant.grantedAt.toISOString(),
  };
}
