import type {
  RequirementControlLinkControlRef,
  RequirementControlLinkRecord,
  RequirementControlLinkUserRef,
} from '../../domain/requirement-control-link.entity';

export interface RequirementControlLinkResponse {
  readonly id: string;
  readonly control: RequirementControlLinkControlRef;
  readonly linkedBy: RequirementControlLinkUserRef;
  readonly linkedAt: string;
  readonly unlinkedBy: RequirementControlLinkUserRef | null;
  readonly unlinkedAt: string | null;
}

export function toRequirementControlLinkResponse(
  record: RequirementControlLinkRecord,
): RequirementControlLinkResponse {
  return {
    id: record.id,
    control: record.control,
    linkedBy: record.linkedBy,
    linkedAt: record.linkedAt.toISOString(),
    unlinkedBy: record.unlinkedBy ?? null,
    unlinkedAt: record.unlinkedAt ? record.unlinkedAt.toISOString() : null,
  };
}
