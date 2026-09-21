/**
 * T032/004-compliance-management, User Story 2 — domain shape for
 * `RequirementControlLink` (data-model.md §4, ADR-017, ADR-020). No
 * derived invariant lives here, unlike `Control`'s own entity file:
 * linking is permitted regardless of the requirement's version status or
 * applicability declaration (contract's own `linkRequirementToControl`
 * description) — there is no state machine to gate it, only the
 * uniqueness-of-active-link rule the repository's partial unique index
 * (and, defensively, `findActiveLink`) already enforces. `isLinkWithdrawn`
 * below is the one predicate every consumer (use cases, response mapper)
 * needs instead of re-deriving `unlinkedAt !== undefined` inline.
 */
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

/** One `RequirementControlLink`, exactly as the presentation layer's
 * mapper needs it — mirrors `RequirementRecord`'s own convention of a
 * plain domain-level shape, never a re-export of a Prisma model
 * (ADR-009). */
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
