/**
 * T180 — maps `OrgUnitAdminRecord` to `contracts/admin.openapi.yaml`'s
 * `OrgUnitNode` response schema.
 */
import type { OrgUnitAdminRecord } from '../../domain/ports/org-unit-admin-repository.port';

export interface OrgUnitNodeResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: string;
  readonly childCount: number;
}

export function toOrgUnitNodeResponse(unit: OrgUnitAdminRecord): OrgUnitNodeResponse {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    parentId: unit.parentId ?? null,
    depth: unit.depth,
    status: unit.status,
    childCount: unit.childCount,
  };
}
