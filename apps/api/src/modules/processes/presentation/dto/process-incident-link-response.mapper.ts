/**
 * 013-incidents-problems-reverse-links — maps `IncidentProcessLinkReadRecord`
 * (`shared/grc-ports/incident-process-link-read.port.ts`) to the
 * `ProcessIncidentLinkResponse` wire shape backing
 * `GET /processes/{processId}/incidents`. Mirrors
 * `modules/assets/presentation/dto/asset-incident-link-response.mapper.ts`
 * exactly, against `Process`.
 */
import type { IncidentProcessLinkReadRecord } from '../../../../shared/grc-ports/incident-process-link-read.port';
import type { IncidentStatus } from '@prisma/client';

export interface ProcessIncidentLinkUserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface ProcessIncidentRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatus;
}

export interface ProcessIncidentLinkResponse {
  readonly id: string;
  readonly incident: ProcessIncidentRefResponse;
  readonly linkedBy: ProcessIncidentLinkUserRefResponse;
  readonly linkedAt: string;
  // No `unlinkedBy` — mirrors `IncidentRiskLinkResponse`/
  // `IncidentProblemLinkResponse`'s own precedent (incidents.openapi.yaml):
  // who withdrew the link is not exposed on this same entity's reverse
  // read either, only that it was.
  readonly unlinkedAt: string | null;
}

export function toProcessIncidentLinkResponse(
  record: IncidentProcessLinkReadRecord,
): ProcessIncidentLinkResponse {
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
