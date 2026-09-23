import type { FindingControlLinkRecord } from '../finding-control-link.entity';

export abstract class FindingControlLinkRepositoryPort {
  abstract findActiveLink(
    findingId: string,
    controlId: string,
  ): Promise<FindingControlLinkRecord | undefined>;

  abstract create(
    findingId: string,
    controlId: string,
    linkedByUserId: string,
  ): Promise<FindingControlLinkRecord>;

  abstract findById(
    findingId: string,
    linkId: string,
  ): Promise<FindingControlLinkRecord | undefined>;

  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<FindingControlLinkRecord>;

  abstract listByFinding(
    findingId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly FindingControlLinkRecord[]>;
}
