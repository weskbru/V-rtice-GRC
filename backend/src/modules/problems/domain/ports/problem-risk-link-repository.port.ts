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
