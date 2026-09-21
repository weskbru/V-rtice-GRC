/**
 * 008-incidents-problems, US3 — `IncidentRiskLinkRepositoryPort`. Mirrors
 * `grc/finding/domain/ports/finding-risk-link-repository.port.ts` exactly
 * — see that file's header.
 *
 * `modules/incidents/infrastructure/prisma-incident-risk-link.repository.ts`
 * is the sole implementation, wired in `incidents.module.ts`.
 */
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

  /** FR-012 — ends the link WITHOUT deleting the row. */
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
