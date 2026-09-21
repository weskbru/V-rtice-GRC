/**
 * 008-incidents-problems, US3 (data-model.md §6, research.md D-13 to
 * D-15) — `ProblemIncidentLinkRepositoryPort`. Unlike
 * `IncidentProblemLinkReadPort` (read-only, from the Incident side), THIS
 * port owns the full write path — `modules/problems` is the sole writer
 * of `problem_incident_links`.
 *
 * `infrastructure/prisma-problem-incident-link.repository.ts` is the sole
 * implementation, wired in `problems.module.ts`.
 */
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

  /** Ends the link WITHOUT deleting the row. */
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
