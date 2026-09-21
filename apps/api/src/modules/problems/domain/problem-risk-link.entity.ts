/**
 * 008-incidents-problems, US3 — domain shape for `ProblemRiskLink`.
 * Mirrors `modules/incidents/domain/incident-risk-link.entity.ts` exactly
 * — see that file's header for the account this one does not repeat.
 */
export interface ProblemRiskLinkRiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface ProblemRiskLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface ProblemRiskLinkRecord {
  readonly id: string;
  readonly problemId: string;
  readonly risk: ProblemRiskLinkRiskRef;
  readonly linkedBy: ProblemRiskLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: ProblemRiskLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}
