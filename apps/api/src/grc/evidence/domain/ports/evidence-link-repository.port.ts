/**
 * T028/002-shared-grc-foundation, US1 — `EvidenceLinkRepositoryPort`
 * (data-model.md §3, ADR-004, ADR-018, FR-007, FR-008). Sole
 * implementation: `grc/evidence/infrastructure/prisma-evidence-link
 * .repository.ts`.
 *
 * `subjectId` carries no FK (R-001) — this port never joins to the
 * subject's own table (it cannot: `grc` may not import `modules`). Every
 * method here operates purely on `evidence_links`' own columns; resolving
 * whether a subject is visible to a given actor is
 * `EvidenceSubjectResolverPort`'s job (`grc/shared/domain/ports`), applied
 * by the application layer, never by this repository.
 */
import type { UserRefRecord } from './evidence-repository.port';
import type { EvidenceSubjectType } from '@prisma/client';

export interface EvidenceLinkRecord {
  readonly id: string;
  readonly evidenceId: string;
  readonly subjectType: EvidenceSubjectType;
  readonly subjectId: string;
  readonly note: string | undefined;
  readonly linkedAt: Date;
  readonly linkedBy: UserRefRecord;
  readonly unlinkedAt: Date | undefined;
  readonly unlinkedBy: UserRefRecord | undefined;
}

export interface CreateEvidenceLinkInput {
  readonly evidenceId: string;
  readonly subjectType: EvidenceSubjectType;
  readonly subjectId: string;
  readonly note: string | undefined;
  readonly linkedByUserId: string;
  readonly linkedAt: Date;
}

export abstract class EvidenceLinkRepositoryPort {
  abstract create(input: CreateEvidenceLinkInput): Promise<EvidenceLinkRecord>;

  /** The currently-ACTIVE link (`unlinkedAt IS NULL`) for this exact
   * `(evidenceId, subjectType, subjectId)` triple, or `undefined`. Backs
   * `LinkEvidenceUseCase`'s pre-check ahead of the partial unique index's
   * own race-free `409` (Invariant L1) — the identical two-layer shape
   * `RiskControlLinkRepositoryPort.findActiveLink` establishes. */
  abstract findActiveLink(
    evidenceId: string,
    subjectType: EvidenceSubjectType,
    subjectId: string,
  ): Promise<EvidenceLinkRecord | undefined>;

  /** Single-row lookup, scoped to `evidenceId` so a `linkId` belonging to a
   * DIFFERENT evidence never resolves through this evidence's own
   * `/links/{linkId}/unlink` route. */
  abstract findById(evidenceId: string, linkId: string): Promise<EvidenceLinkRecord | undefined>;

  /** FR-008 — ends the link WITHOUT deleting the row (`unlinkedAt`/
   * `unlinkedByUserId` stamped; every other column untouched). */
  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<EvidenceLinkRecord>;

  /** Every link for `evidenceId`, newest first. `includeUnlinked: false`
   * (the `listEvidenceLinks` default) returns only currently-ACTIVE links;
   * `true` returns the full history, including ended links —
   * `contracts/grc-foundation.openapi.yaml`'s `includeUnlinked` query
   * parameter. Access to `evidenceId` itself must already have been
   * authorized by the caller; subject-level visibility filtering (R-010)
   * is the APPLICATION layer's job (`ListEvidenceLinksUseCase`), never
   * this repository's — it has no way to resolve subject visibility at
   * all (see this file's header). */
  abstract listByEvidence(
    evidenceId: string,
    includeUnlinked: boolean,
  ): Promise<readonly EvidenceLinkRecord[]>;

  /**
   * T017/005-audit-findings (research.md D-6) — `true` when at least one
   * ACTIVE (`unlinkedAt IS NULL`) `EvidenceLink` exists for `(subjectType,
   * subjectId)`, regardless of the referenced `Evidence`'s own `status`
   * (archived evidence still sustains this check — only the total absence
   * of a link refuses, FR-010). Consumed by `CloseFindingUseCase`
   * (`grc/finding`) for the new, ADDITIVE Invariant F5 — this method never
   * changes `findActiveLink`/`findById`/`unlink`/`listByEvidence` above,
   * all of which keep their existing signature.
   */
  abstract hasActiveLinkForSubject(
    subjectType: EvidenceSubjectType,
    subjectId: string,
  ): Promise<boolean>;
}
