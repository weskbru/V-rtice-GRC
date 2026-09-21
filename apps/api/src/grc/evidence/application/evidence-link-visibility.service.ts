/**
 * T033/002-shared-grc-foundation, US1 — R-010's "visible-only" projection,
 * factored into one shared service so `ListEvidenceLinksUseCase`,
 * `GetEvidenceUseCase` and `ListEvidenceUseCase` (the `linkCount` field on
 * `Evidence`, contracts/grc-foundation.openapi.yaml) all compute it the
 * SAME way rather than three independent copies of the same try/catch
 * loop (CLAUDE.md §19.7: derived state has exactly one calculator).
 *
 * ## The rule (R-010)
 *
 * A link's subject is visible to `actorUserId` only when
 * `EvidenceSubjectResolverPort`'s registered accessor for that subject
 * type resolves it without throwing `NotFoundDomainError` — the SAME
 * "existence, scope and view permission" check `LinkEvidenceUseCase`
 * performs before creating a link in the first place, applied here on
 * READ. A subject the caller may not see is silently OMITTED, never
 * surfaced with a placeholder — disclosing that *something* is linked but
 * hidden would itself leak existence (R-010's own stated reasoning).
 *
 * ## Known, accepted cost
 *
 * Each visible link costs one accessor call (typically one scoped
 * database read on the subject's own module). `ListEvidenceUseCase`
 * applies this per row of a page (up to 100, contracts/grc-foundation
 * .openapi.yaml's `PageSize` maximum) to populate `Evidence.linkCount`.
 * There is no way to push subject-visibility filtering into a single SQL
 * query here — `EvidenceLink.subjectId` carries no FK (R-001) precisely
 * because a real join would require `grc` to import every business
 * module, which ADR-016 forbids — so this N calls-per-page cost is the
 * accepted, deliberate trade-off of that architectural boundary, not an
 * oversight. It is unproblematic at this foundation phase's scale (SC-010
 * is about the LISTING query itself using an index, which it does; this
 * is a secondary per-row aggregate, not the register scan).
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { getEvidenceSubjectAccessor } from '../../shared/domain/ports/evidence-subject-resolver.port';
import { EvidenceLinkRepositoryPort } from '../domain/ports/evidence-link-repository.port';

import type { EvidenceLinkRecord } from '../domain/ports/evidence-link-repository.port';

export interface VisibleEvidenceLink extends EvidenceLinkRecord {
  readonly subjectLabel: string;
}

@Injectable()
export class EvidenceLinkVisibilityService {
  constructor(private readonly linkRepository: EvidenceLinkRepositoryPort) {}

  /** Every link for `evidenceId` (per `includeUnlinked`) whose SUBJECT is
   * currently visible to `actorUserId`, each carrying the subject's
   * resolved display label. Order is preserved from the repository read
   * (newest-linked first). */
  async resolveVisibleLinks(
    evidenceId: string,
    actorUserId: string,
    includeUnlinked: boolean,
  ): Promise<readonly VisibleEvidenceLink[]> {
    const links = await this.linkRepository.listByEvidence(evidenceId, includeUnlinked);
    const visible: VisibleEvidenceLink[] = [];

    for (const link of links) {
      const accessor = getEvidenceSubjectAccessor(link.subjectType);
      try {
        const access = await accessor.resolveViewableSubject(actorUserId, link.subjectId);
        visible.push({ ...link, subjectLabel: access.label });
      } catch (error) {
        if (error instanceof NotFoundDomainError) {
          // R-010: the subject exists (or doesn't) and the caller may not
          // see it either way — omit the link entirely rather than
          // surfacing a placeholder that would itself disclose "something
          // is linked here".
          continue;
        }
        throw error;
      }
    }

    return visible;
  }

  /** The count `Evidence.linkCount` reports — the number of currently
   * ACTIVE links whose subject `actorUserId` may currently see. */
  async countVisibleActiveLinks(evidenceId: string, actorUserId: string): Promise<number> {
    const visible = await this.resolveVisibleLinks(evidenceId, actorUserId, false);
    return visible.length;
  }
}
