import type { ProblemIncidentLinkRecord } from '../problem-incident-link.entity';

export abstract class ProblemIncidentLinkRepositoryPort {
  abstract findActiveLink(
    problemId: string,
    incidentId: string,
  ): Promise<ProblemIncidentLinkRecord | undefined>;

  abstract create(
    problemId: string,
    incidentId: string,
    linkedByUserId: string,
  ): Promise<ProblemIncidentLinkRecord>;

  abstract findById(
    problemId: string,
    linkId: string,
  ): Promise<ProblemIncidentLinkRecord | undefined>;

  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<ProblemIncidentLinkRecord>;

  abstract listByProblem(
    problemId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemIncidentLinkRecord[]>;
}
