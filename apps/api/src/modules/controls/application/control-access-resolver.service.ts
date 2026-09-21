/**
 * T027-T042/003-controls-management, User Story 2/3 — the one place every
 * use case in this workstream resolves "does this control exist, is it
 * within the caller's scope, and who is the caller" (FR-007), so the F-38
 * non-disclosure pattern (`OrgScopeEnforcerService.assertExistingRecordAccessible`)
 * is applied identically by every one of them rather than re-implemented
 * per use case. Mirrors the shape `GetRiskUseCase`/`GetFindingUseCase`
 * establish for their own modules, factored out here because THIS
 * workstream has many small use cases (assessments, attestation, two
 * kinds of link) that all need the identical parent-control resolution
 * rather than one "get the aggregate" use case of their own.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ControlLookupPort } from '../domain/ports/control-lookup.port';
import { ControlReferenceDataPort } from '../domain/ports/control-reference-data.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ControlLookupRecord } from '../domain/ports/control-lookup.port';

export interface ResolvedControlAccess {
  readonly scope: ScopeFilter;
  readonly control: ControlLookupRecord;
}

export interface ResolvedActor {
  readonly id: string;
  readonly fullName: string;
}

@Injectable()
export class ControlAccessResolver {
  constructor(
    private readonly controlLookup: ControlLookupPort,
    private readonly referenceData: ControlReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  /** Every use case in this workstream calls this first — mirrors
   * `RequestApprovalUseCase`'s own `referenceData.findUser` call: an
   * authenticated session whose user row has since been deleted/deactivated
   * out from under it is treated as unauthenticated, never as "found with
   * blank fields". */
  async resolveActor(actorUserId: string): Promise<ResolvedActor> {
    const actor = await this.referenceData.findUser(actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }
    return { id: actor.id, fullName: actor.fullName };
  }

  /**
   * Resolves the caller's scope and the parent control within it. When the
   * scoped lookup returns nothing, applies the F-38 pattern
   * (`OrgScopeEnforcerService.assertExistingRecordAccessible`) so an
   * out-of-scope control is audited as a DENIED access attempt and a
   * genuinely missing one is not — both answer identically to the caller
   * (FR-007).
   */
  async resolveControl(actorUserId: string, controlId: string): Promise<ResolvedControlAccess> {
    const scope = await this.scopeResolver.resolveScope(actorUserId);
    const control = await this.controlLookup.findScoped(scope, controlId);
    if (!control) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId,
          entityType: AuditEntityType.CONTROL,
          entityId: controlId,
          entityLabel: USER_MESSAGES.controls.entityLabel,
        },
        () => this.controlLookup.findOrgUnitIdUnscoped(controlId),
      );
    }
    return { scope, control };
  }
}
