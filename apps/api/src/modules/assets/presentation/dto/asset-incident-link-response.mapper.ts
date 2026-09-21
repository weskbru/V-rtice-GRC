/**
 * 013-incidents-problems-reverse-links — maps `IncidentAssetLinkReadRecord`
 * (`shared/grc-ports/incident-asset-link-read.port.ts`) to the
 * `AssetIncidentLinkResponse` wire shape backing
 * `GET /assets/{assetId}/incidents`. A separate file from
 * `asset-response.mapper.ts` — that file maps `AssetRecord` itself; this
 * one maps the read-only reverse listing of a link table `modules/assets`
 * does not own (ADR-009: the ONE place this record becomes a response
 * body).
 */
import type { IncidentAssetLinkReadRecord } from '../../../../shared/grc-ports/incident-asset-link-read.port';
import type { IncidentStatus } from '@prisma/client';

export interface AssetIncidentLinkUserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface AssetIncidentRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatus;
}

export interface AssetIncidentLinkResponse {
  readonly id: string;
  readonly incident: AssetIncidentRefResponse;
  readonly linkedBy: AssetIncidentLinkUserRefResponse;
  readonly linkedAt: string;
  // No `unlinkedBy` — mirrors `IncidentRiskLinkResponse`/
  // `IncidentProblemLinkResponse`'s own precedent (incidents.openapi.yaml):
  // who withdrew the link is not exposed on this same entity's reverse
  // read either, only that it was.
  readonly unlinkedAt: string | null;
}

export function toAssetIncidentLinkResponse(
  record: IncidentAssetLinkReadRecord,
): AssetIncidentLinkResponse {
  return {
    id: record.id,
    incident: {
      id: record.incident.id,
      code: record.incident.code,
      title: record.incident.title,
      status: record.incident.status,
    },
    linkedBy: { id: record.linkedBy.id, fullName: record.linkedBy.fullName },
    linkedAt: record.linkedAt.toISOString(),
    unlinkedAt: record.unlinkedAt ? record.unlinkedAt.toISOString() : null,
  };
}
