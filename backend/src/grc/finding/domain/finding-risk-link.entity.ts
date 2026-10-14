export interface FindingRiskLinkRiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface FindingRiskLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface FindingRiskLinkRecord {
  readonly id: string;
  readonly findingId: string;
  readonly risk: FindingRiskLinkRiskRef;
  readonly linkedBy: FindingRiskLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: FindingRiskLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}

export function isFindingRiskLinkWithdrawn(link: FindingRiskLinkRecord): boolean {
  return link.unlinkedAt !== undefined;
}
