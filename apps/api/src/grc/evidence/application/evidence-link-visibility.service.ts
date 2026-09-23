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
          continue;
        }
        throw error;
      }
    }

    return visible;
  }

  async countVisibleActiveLinks(evidenceId: string, actorUserId: string): Promise<number> {
    const visible = await this.resolveVisibleLinks(evidenceId, actorUserId, false);
    return visible.length;
  }
}
