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
