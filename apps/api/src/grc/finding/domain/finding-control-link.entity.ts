/**
 * T060/005-audit-findings, US3 — domain shape for `FindingControlLink`
 * (data-model.md §5, research.md D-4, ADR-020 parts 1/2). Mirrors
 * `modules/compliance/domain/requirement-control-link.entity.ts` exactly —
 * see that file's header for why no state machine lives here: linking is
 * permitted regardless of the control's own lifecycle status (the spec's
 * own edge case, "Controle aposentado ligado a achado aberto: o vínculo
 * permanece" — only WRITE-time state is checked, by the use case, via
 * `ControlDirectoryPort`); the one thing this file owns is the shape and
 * the "is this link currently withdrawn" predicate every consumer needs.
 *
 * `ControlDirectoryPort`'s own minimal projection (`{ id, code, name }`,
 * ADR-020 part 4) is exactly what `FindingControlLinkControlRef` needs —
 * this file does not widen it.
 */
export interface FindingControlLinkControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface FindingControlLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

/** One `FindingControlLink`, exactly as the presentation layer's mapper
 * needs it — a plain domain-level shape, never a re-export of a Prisma
 * model (ADR-009). */
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
