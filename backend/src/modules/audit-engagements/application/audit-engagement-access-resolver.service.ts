import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { AuditEngagementReferenceDataPort } from '../domain/ports/audit-engagement-reference-data.port';
import { AuditEngagementRepositoryPort } from '../domain/ports/audit-engagement-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { AuditEngagementRecord } from '../domain/ports/audit-engagement-repository.port';

export interface ResolvedAuditEngagementAccess {
  readonly scope: ScopeFilter;
  readonly auditEngagement: AuditEngagementRecord;
}

export interface ResolvedActor {
  readonly id: string;
  readonly fullName: string;
}

@Injectable()
export class AuditEngagementAccessResolver {
  constructor(
    private readonly auditEngagementRepository: AuditEngagementRepositoryPort,
    private readonly referenceData: AuditEngagementReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async resolveActor(actorUserId: string): Promise<ResolvedActor> {
    const actor = await this.referenceData.findUser(actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }
    return { id: actor.id, fullName: actor.fullName };
  }

  async resolveAuditEngagement(
    actorUserId: string,
    auditEngagementId: string,
  ): Promise<ResolvedAuditEngagementAccess> {
    const scope = await this.scopeResolver.resolveScope(actorUserId);
    const auditEngagement = await this.auditEngagementRepository.findById(scope, auditEngagementId);
    if (!auditEngagement) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId,
          entityType: AuditEntityType.AUDIT_ENGAGEMENT,
          entityId: auditEngagementId,
          entityLabel: USER_MESSAGES.auditEngagements.entityLabel,
        },
        () => this.auditEngagementRepository.findOrgUnitIdUnscoped(auditEngagementId),
      );
    }
    return { scope, auditEngagement };
  }
}
