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

  async resolveActor(actorUserId: string): Promise<ResolvedActor> {
    const actor = await this.referenceData.findUser(actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }
    return { id: actor.id, fullName: actor.fullName };
  }

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
