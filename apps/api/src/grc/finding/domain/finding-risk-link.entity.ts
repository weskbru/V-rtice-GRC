/**
 * T061/005-audit-findings, US3 — domain shape for `FindingRiskLink`
 * (data-model.md §6, research.md D-4, ADR-020 parts 1/2). Sibling of
 * `finding-control-link.entity.ts`, same reasoning — see that file's
 * header for why no state machine lives here either: linking is permitted
 * against a risk in any lifecycle status except `ARCHIVED` (checked at
 * write time by the use case, via `RiskDirectoryPort`'s `isActive`).
 */
export interface FindingRiskLinkRiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface FindingRiskLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

/** One `FindingRiskLink`, exactly as the presentation layer's mapper needs
 * it — a plain domain-level shape, never a re-export of a Prisma model
 * (ADR-009). */
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
