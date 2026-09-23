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
