/**
 * 008-incidents-problems, US3 (spec.md FR-013, data-model.md §2) — domain
 * shape for `IncidentProcessLink`. Sibling of
 * `incident-risk-link.entity.ts`, same reasoning, against `Process`
 * instead of `Risk`.
 */
export interface IncidentProcessLinkProcessRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface IncidentProcessLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentProcessLinkRecord {
  readonly id: string;
  readonly incidentId: string;
  readonly process: IncidentProcessLinkProcessRef;
  readonly linkedBy: IncidentProcessLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: IncidentProcessLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}
