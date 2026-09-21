/**
 * T060/005-audit-findings, US3 — `FindingControlLinkRepositoryPort`
 * (data-model.md §5, ADR-004, ADR-020 parts 1/2). Mirrors
 * `modules/risk/domain/ports/risk-relationship-repository.port.ts`'s
 * `RiskControlLinkRepositoryPort` exactly — no `unlink`-deleting method
 * exists on this port at all (FR-016): withdrawal always stamps
 * `unlinkedAt`/`unlinkedByUserId`.
 *
 * `grc/finding/infrastructure/prisma-finding-control-link.repository.ts` is
 * the sole implementation, wired in `finding.module.ts`.
 */
import type { FindingControlLinkRecord } from '../finding-control-link.entity';

export abstract class FindingControlLinkRepositoryPort {
  /** The currently-active link (`unlinkedAt IS NULL`) for `(findingId,
   * controlId)`, or `undefined` — used by `LinkFindingControlUseCase` to
   * detect "already linked" (409) BEFORE attempting the insert, though the
   * partial unique index is the real, race-free backstop. */
  abstract findActiveLink(
    findingId: string,
    controlId: string,
  ): Promise<FindingControlLinkRecord | undefined>;

  abstract create(
    findingId: string,
    controlId: string,
    linkedByUserId: string,
  ): Promise<FindingControlLinkRecord>;

  /** Single-row lookup by `(findingId, linkId)` — `undefined` if it does
   * not exist or belongs to a different finding. */
  abstract findById(
    findingId: string,
    linkId: string,
  ): Promise<FindingControlLinkRecord | undefined>;

  /** FR-016 — ends the link WITHOUT deleting the row. */
  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<FindingControlLinkRecord>;

  /** `includeWithdrawn`: `false` returns only currently-active links,
   * `true` also returns withdrawn ones with who removed them and when. */
  abstract listByFinding(
    findingId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly FindingControlLinkRecord[]>;
}
