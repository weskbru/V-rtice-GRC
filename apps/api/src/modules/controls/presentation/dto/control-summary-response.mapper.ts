/**
 * T023/003-controls-management — maps `ControlCatalogRow`
 * (`domain/ports/control-query.port.ts`, the catalog's read model) to the
 * wire shape `contracts/controls.openapi.yaml`'s `ControlSummary`
 * describes — one catalog row (`GET /controls`, FR-007). The catalog's own
 * mapper, separate from `control-response.mapper.ts`'s
 * `toControlDetailResponse` (`GET /controls/{controlId}`'s single-control
 * `ControlDetail`) — different input type, same "one mapper is the only
 * place a domain object becomes a DTO" discipline (ADR-009). Reuses
 * `ControlOrgUnitRefResponse`/`ControlUserRefResponse` from
 * `control-response.mapper.ts` rather than redeclaring identical shapes.
 */
import { isActiveForControlStatus } from '../../domain/control.entity';

import type {
  ControlOrgUnitRefResponse,
  ControlSummaryResponse,
  ControlUserRefResponse,
} from './control-response.mapper';
import type { ControlCatalogRow } from '../../domain/ports/control-query.port';

function toOrgUnitRefResponse(ref: ControlCatalogRow['orgUnit']): ControlOrgUnitRefResponse | null {
  return ref ? { id: ref.id, code: ref.code, name: ref.name } : null;
}

function toUserRefResponse(ref: ControlCatalogRow['owner']): ControlUserRefResponse | null {
  return ref ? { id: ref.id, fullName: ref.fullName, email: ref.email } : null;
}

export function toControlSummaryResponse(row: ControlCatalogRow): ControlSummaryResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    descriptionExcerpt: row.descriptionExcerpt,
    description: row.description,
    orgUnit: toOrgUnitRefResponse(row.orgUnit),
    owner: toUserRefResponse(row.owner),
    nature: row.nature ?? null,
    type: row.type ?? null,
    frequency: row.frequency ?? null,
    status: row.status,
    isActive: isActiveForControlStatus(row.status),
    effectiveness: row.effectiveness,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}
