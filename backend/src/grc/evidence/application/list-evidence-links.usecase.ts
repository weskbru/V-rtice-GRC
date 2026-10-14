import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { EvidenceRepositoryPort } from '../domain/ports/evidence-repository.port';

import { EvidenceLinkVisibilityService } from './evidence-link-visibility.service';

import type { VisibleEvidenceLink } from './evidence-link-visibility.service';

export interface ListEvidenceLinksInput {
  readonly actorUserId: string;
  readonly evidenceId: string;
  readonly includeUnlinked: boolean;
}

@Injectable()
export class ListEvidenceLinksUseCase {
  constructor(
    private readonly evidenceRepository: EvidenceRepositoryPort,
    private readonly visibilityService: EvidenceLinkVisibilityService,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListEvidenceLinksInput): Promise<readonly VisibleEvidenceLink[]> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const evidence = await this.evidenceRepository.findById(scope, input.evidenceId);
    if (!evidence) {
      throw new NotFoundDomainError(USER_MESSAGES.evidence.entityLabel, input.evidenceId);
    }

    return this.visibilityService.resolveVisibleLinks(
      input.evidenceId,
      input.actorUserId,
      input.includeUnlinked,
    );
  }
}
