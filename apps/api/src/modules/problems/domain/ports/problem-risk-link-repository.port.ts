/**
 * 008-incidents-problems, US3 — `ProblemRiskLinkRepositoryPort`. Mirrors
 * `modules/incidents/domain/ports/incident-risk-link-repository.port.ts`
 * exactly.
 *
 * `infrastructure/prisma-problem-risk-link.repository.ts` is the sole
 * implementation, wired in `problems.module.ts`.
 */
import type { ProblemRiskLinkRecord } from '../problem-risk-link.entity';

export abstract class ProblemRiskLinkRepositoryPort {
  abstract findActiveLink(
    problemId: string,
    riskId: string,
  ): Promise<ProblemRiskLinkRecord | undefined>;

  abstract create(
    problemId: string,
    riskId: string,
    linkedByUserId: string,
  ): Promise<ProblemRiskLinkRecord>;

  abstract findById(problemId: string, linkId: string): Promise<ProblemRiskLinkRecord | undefined>;

  /** Ends the link WITHOUT deleting the row. */
  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<ProblemRiskLinkRecord>;

  abstract listByProblem(
    problemId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemRiskLinkRecord[]>;
}
