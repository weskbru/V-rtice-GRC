/**
 * T061/005-audit-findings, US3 — `FindingRiskLinkRepositoryPort`. Sibling
 * of `finding-control-link-repository.port.ts`, same reasoning — see that
 * file's header.
 *
 * `grc/finding/infrastructure/prisma-finding-risk-link.repository.ts` is
 * the sole implementation, wired in `finding.module.ts`.
 */
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

  /** FR-016 — ends the link WITHOUT deleting the row. */
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
