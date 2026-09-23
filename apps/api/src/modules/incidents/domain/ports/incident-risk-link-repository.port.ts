import type { IncidentRiskLinkRecord } from '../incident-risk-link.entity';

export abstract class IncidentRiskLinkRepositoryPort {
  abstract findActiveLink(
    incidentId: string,
    riskId: string,
  ): Promise<IncidentRiskLinkRecord | undefined>;

  abstract create(
    incidentId: string,
    riskId: string,
    linkedByUserId: string,
  ): Promise<IncidentRiskLinkRecord>;

  abstract findById(
    incidentId: string,
    linkId: string,
  ): Promise<IncidentRiskLinkRecord | undefined>;

  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<IncidentRiskLinkRecord>;

  abstract listByIncident(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentRiskLinkRecord[]>;
}
