/**
 * T032/002-shared-grc-foundation, US1 — `ListEvidenceUseCase` (`listEvidence`,
 * FR-006, SC-010). Scoped register listing, mirroring
 * `modules/risk/application/list-risks.usecase.ts`'s shape.
 *
 * ## `subjectType`/`subjectId` — the "evidence panel on a domain screen" filter
 *
 * The original design contract had no way for a domain screen (the risk
 * detail page, US1's own SC-001: "vincula um risco ... sem sair do
 * contexto do risco") to ask "which evidence is linked to THIS record" —
 * `listEvidenceLinks` only answers the opposite direction (a known
 * evidence's own subjects). This is a spec/reality gap closed here,
 * additively: an optional pair of query parameters on the SAME endpoint,
 * both-or-neither. When present, the subject's own visibility is resolved
 * FIRST, through the exact same `EvidenceSubjectResolverPort` accessor
 * `LinkEvidenceUseCase`/`ListEvidenceLinksUseCase` already use — so this
 * filter can never become a side channel that discloses "evidence exists
 * for subject X" to a caller who could not otherwise see subject X at all
 * (R-010's own reasoning, applied to a new read path rather than only the
 * one the original design anticipated).
 */
import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { parseIsoDate } from '../../shared/domain/iso-date';
import { getEvidenceSubjectAccessor } from '../../shared/domain/ports/evidence-subject-resolver.port';
import { EvidenceRepositoryPort } from '../domain/ports/evidence-repository.port';

import { EvidenceLinkVisibilityService } from './evidence-link-visibility.service';

import type { EvidenceWithLinkCount } from './get-evidence.usecase';
import type { EvidenceStatus, EvidenceSubjectType, EvidenceType } from '@prisma/client';

export interface ListEvidenceInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: EvidenceStatus | undefined;
  readonly type?: EvidenceType | undefined;
  readonly ownerUserId?: string | undefined;
  readonly orgUnitId?: string | undefined;
  /** ISO `YYYY-MM-DD` — evidence whose `validUntil` falls before this date
   * (the expiry view, FR-006). */
  readonly expiringBefore?: string | undefined;
  readonly search?: string | undefined;
  readonly subjectType?: EvidenceSubjectType | undefined;
  readonly subjectId?: string | undefined;
}

export interface EvidenceListResult {
  readonly items: readonly EvidenceWithLinkCount[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

@Injectable()
export class ListEvidenceUseCase {
  constructor(
    private readonly evidenceRepository: EvidenceRepositoryPort,
    private readonly visibilityService: EvidenceLinkVisibilityService,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListEvidenceInput): Promise<EvidenceListResult> {
    const hasSubjectType = input.subjectType !== undefined;
    const hasSubjectId = input.subjectId !== undefined;
    if (hasSubjectType !== hasSubjectId) {
      throw new ValidationDomainError(USER_MESSAGES.evidence.subjectFilterIncomplete, [
        { field: 'subjectId', message: USER_MESSAGES.evidence.subjectFilterIncomplete },
      ]);
    }

    if (input.subjectType !== undefined && input.subjectId !== undefined) {
      // See this file's header — resolved BEFORE the filter reaches the
      // repository, so an actor who cannot see the subject gets the SAME
      // 404 `LinkEvidenceUseCase` would give them, never a filtered
      // (but silently non-empty-implying) evidence list.
      const accessor = getEvidenceSubjectAccessor(input.subjectType);
      await accessor.resolveViewableSubject(input.actorUserId, input.subjectId);
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const page = await this.evidenceRepository.list(
      scope,
      {
        status: input.status,
        type: input.type,
        ownerUserId: input.ownerUserId,
        orgUnitId: input.orgUnitId,
        expiringBefore: input.expiringBefore ? parseIsoDate(input.expiringBefore) : undefined,
        search: input.search,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
      input.page,
      input.pageSize,
    );

    // See `EvidenceLinkVisibilityService`'s own header for the accepted
    // per-row cost of this loop (R-010's visible-only `linkCount`).
    const items = await Promise.all(
      page.items.map(async (record) => ({
        ...record,
        linkCount: await this.visibilityService.countVisibleActiveLinks(
          record.id,
          input.actorUserId,
        ),
      })),
    );

    return { items, page: page.page, pageSize: page.pageSize, total: page.total };
  }
}
