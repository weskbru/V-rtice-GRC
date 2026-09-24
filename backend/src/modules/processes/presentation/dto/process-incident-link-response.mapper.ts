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
