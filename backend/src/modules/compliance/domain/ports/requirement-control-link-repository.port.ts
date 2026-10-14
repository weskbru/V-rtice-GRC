import type { RequirementControlLinkRecord } from '../requirement-control-link.entity';

export abstract class RequirementControlLinkRepositoryPort {
  abstract findActiveLink(
    requirementId: string,
    controlId: string,
  ): Promise<RequirementControlLinkRecord | undefined>;

  abstract create(
    requirementId: string,
    controlId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<RequirementControlLinkRecord>;

  abstract findById(
    requirementId: string,
    linkId: string,
  ): Promise<RequirementControlLinkRecord | undefined>;

  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<RequirementControlLinkRecord>;

  abstract list(
    requirementId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly RequirementControlLinkRecord[]>;

  abstract findActiveControlIdsByRequirement(
    requirementIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
