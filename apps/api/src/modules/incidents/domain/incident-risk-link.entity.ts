/**
 * 008-incidents-problems, US3 (spec.md FR-013, data-model.md §2) — domain
 * shape for `IncidentRiskLink`. Mirrors `grc/finding/domain/
 * finding-risk-link.entity.ts` exactly — see that file's header for why no
 * state machine lives here: linking is permitted regardless of the risk's
 * own lifecycle status (this pair has no `assertXEditable`-style gate the
 * way Finding does, per spec.md's own relationship table).
 */
export interface IncidentRiskLinkRiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface IncidentRiskLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

/** One `IncidentRiskLink`, exactly as the presentation layer's mapper
 * needs it — a plain domain-level shape, never a re-export of a Prisma
 * model (ADR-009). */
export interface IncidentRiskLinkRecord {
  readonly id: string;
  readonly incidentId: string;
  readonly risk: IncidentRiskLinkRiskRef;
  readonly linkedBy: IncidentRiskLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: IncidentRiskLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}
