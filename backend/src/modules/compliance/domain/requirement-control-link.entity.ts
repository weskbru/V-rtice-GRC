export interface RequirementControlLinkControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RequirementControlLinkUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface RequirementControlLinkRecord {
  readonly id: string;
  readonly requirementId: string;
  readonly control: RequirementControlLinkControlRef;
  readonly linkedBy: RequirementControlLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: RequirementControlLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}

export function isLinkWithdrawn(link: RequirementControlLinkRecord): boolean {
  return link.unlinkedAt !== undefined;
}
