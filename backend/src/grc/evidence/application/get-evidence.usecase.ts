import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { EvidenceRepositoryPort } from '../domain/ports/evidence-repository.port';

import { EvidenceLinkVisibilityService } from './evidence-link-visibility.service';

import type { EvidenceRecord } from '../domain/ports/evidence-repository.port';

export interface GetEvidenceInput {
  readonly actorUserId: string;
  readonly evidenceId: string;
}

export interface EvidenceWithLinkCount extends EvidenceRecord {
  readonly linkCount: number;
}

@Injectable()
export class GetEvidenceUseCase {
  constructor(
    private readonly evidenceRepository: EvidenceRepositoryPort,
    private readonly visibilityService: EvidenceLinkVisibilityService,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: GetEvidenceInput): Promise<EvidenceWithLinkCount> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const record = await this.evidenceRepository.findById(scope, input.evidenceId);
    if (!record) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.EVIDENCE,
          entityId: input.evidenceId,
          entityLabel: USER_MESSAGES.evidence.entityLabel,
        },
        () => this.evidenceRepository.findOrgUnitIdUnscoped(input.evidenceId),
      );
    }
    const linkCount = await this.visibilityService.countVisibleActiveLinks(
      record.id,
      input.actorUserId,
    );
    return { ...record, linkCount };
  }
}
