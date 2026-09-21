/**
 * 008-incidents-problems, US3 — `IncidentProcessLinkRepositoryPort`.
 * Sibling of `incident-risk-link-repository.port.ts`, same reasoning,
 * against `Process` instead of `Risk`.
 */
import type { IncidentProcessLinkRecord } from '../incident-process-link.entity';

export abstract class IncidentProcessLinkRepositoryPort {
  abstract findActiveLink(
    incidentId: string,
    processId: string,
  ): Promise<IncidentProcessLinkRecord | undefined>;

  abstract create(
    incidentId: string,
    processId: string,
    linkedByUserId: string,
  ): Promise<IncidentProcessLinkRecord>;

  abstract findById(
    incidentId: string,
    linkId: string,
  ): Promise<IncidentProcessLinkRecord | undefined>;

  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<IncidentProcessLinkRecord>;

  abstract listByIncident(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProcessLinkRecord[]>;
}
