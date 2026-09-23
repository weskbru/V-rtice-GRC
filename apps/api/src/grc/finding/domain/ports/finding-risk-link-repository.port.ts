import type { FindingRiskLinkRecord } from '../finding-risk-link.entity';

export abstract class FindingRiskLinkRepositoryPort {
  abstract findActiveLink(
    findingId: string,
    riskId: string,
  ): Promise<FindingRiskLinkRecord | undefined>;

  abstract create(
    findingId: string,
    riskId: string,
    linkedByUserId: string,
  ): Promise<FindingRiskLinkRecord>;

  abstract findById(findingId: string, linkId: string): Promise<FindingRiskLinkRecord | undefined>;

  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<FindingRiskLinkRecord>;

  abstract listByFinding(
    findingId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly FindingRiskLinkRecord[]>;
}
