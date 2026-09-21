/**
 * T025-T037/005-audit-findings, User Story 1 — the one place every use case
 * in this module resolves "does this engagement exist, is it within the
 * caller's scope, and who is the caller" (FR-018), so the F-38
 * non-disclosure pattern (`OrgScopeEnforcerService.assertExistingRecordAccessible`)
 * is applied identically by every one of them. Mirrors
 * `modules/controls/application/control-access-resolver.service.ts`
 * exactly — see that file's header for the full reasoning this one does
 * not repeat.
 */
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

  /** Every use case in this module calls this first — mirrors
   * `ControlAccessResolver.resolveActor`: an authenticated session whose
   * user row has since been deleted/deactivated out from under it is
   * treated as unauthenticated, never as "found with blank fields". */
  async resolveActor(actorUserId: string): Promise<ResolvedActor> {
    const actor = await this.referenceData.findUser(actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }
    return { id: actor.id, fullName: actor.fullName };
  }

  /**
   * Resolves the caller's scope and the engagement within it. When the
   * scoped lookup returns nothing, applies the F-38 pattern so an
   * out-of-scope engagement is audited as a DENIED access attempt and a
   * genuinely missing one is not — both answer identically to the caller
   * (FR-018, US1 AS5).
   */
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
