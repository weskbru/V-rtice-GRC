export interface FindingControlLinkControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface FindingControlLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface FindingControlLinkRecord {
  readonly id: string;
  readonly findingId: string;
  readonly control: FindingControlLinkControlRef;
  readonly linkedBy: FindingControlLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: FindingControlLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}

export function isFindingControlLinkWithdrawn(link: FindingControlLinkRecord): boolean {
  return link.unlinkedAt !== undefined;
}
