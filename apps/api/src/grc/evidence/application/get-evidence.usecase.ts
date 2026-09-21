/**
 * T032/002-shared-grc-foundation, US1 — `GetEvidenceUseCase`
 * (`getEvidence`, FR-032). Scoped read: an evidence outside the caller's
 * organizational scope reads as `undefined` from the repository, turned
 * into `NotFoundDomainError` here — indistinguishable from a genuinely
 * unknown id (SC-005). Reused verbatim by `EvidenceParentRecordAccessor`
 * (the attachable-entity-type registration, T030a) the same way
 * `RiskParentRecordAccessor` reuses `GetRiskUseCase`.
 */
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

/** `EvidenceRecord` plus `linkCount` (contracts/grc-foundation.openapi.yaml)
 * — "active links the caller may see, not necessarily the true total"
 * (R-010). Computed here, not stored on `EvidenceRecord` itself: the
 * repository has no way to resolve subject visibility (see
 * `EvidenceLinkVisibilityService`'s own header). */
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
      // F-38: recorded server-side, via `assertExistingRecordAccessible`,
      // whenever the evidence actually exists outside `scope`.
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
