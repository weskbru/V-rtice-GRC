import type { IncidentAssetLinkRecord } from '../incident-asset-link.entity';

export abstract class IncidentAssetLinkRepositoryPort {
  abstract findActiveLink(
    incidentId: string,
    assetId: string,
  ): Promise<IncidentAssetLinkRecord | undefined>;

  abstract create(
    incidentId: string,
    assetId: string,
    linkedByUserId: string,
  ): Promise<IncidentAssetLinkRecord>;

  abstract findById(
    incidentId: string,
    linkId: string,
  ): Promise<IncidentAssetLinkRecord | undefined>;

  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<IncidentAssetLinkRecord>;

  abstract listByIncident(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentAssetLinkRecord[]>;
}
