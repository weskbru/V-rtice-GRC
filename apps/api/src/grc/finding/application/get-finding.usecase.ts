/**
 * T070/002-shared-grc-foundation, US3 — `GetFindingUseCase` (`getFinding`,
 * FR-032). Scoped read: a finding outside the caller's organizational
 * scope reads as `undefined` from the repository, turned into
 * `NotFoundDomainError` here — indistinguishable from a genuinely unknown
 * id (SC-005). Reused verbatim by `FindingEvidenceSubjectAccessor`/
 * `FindingActionOriginAccessor` (T072), the same way `GetActionUseCase` is
 * reused by `ActionEvidenceSubjectAccessor`.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { FindingRepositoryPort } from '../domain/ports/finding-repository.port';

import type { FindingRecord } from '../domain/ports/finding-repository.port';

export interface GetFindingInput {
  readonly actorUserId: string;
  readonly findingId: string;
}

@Injectable()
export class GetFindingUseCase {
  constructor(
    private readonly findingRepository: FindingRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: GetFindingInput): Promise<FindingRecord> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const record = await this.findingRepository.findById(scope, input.findingId);
    if (!record) {
      // F-38: recorded server-side, via `assertExistingRecordAccessible`,
      // whenever the finding actually exists outside `scope`.
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.FINDING,
          entityId: input.findingId,
          entityLabel: USER_MESSAGES.findings.entityLabel,
        },
        () => this.findingRepository.findOrgUnitIdUnscoped(input.findingId),
      );
    }
    return record;
  }
}
