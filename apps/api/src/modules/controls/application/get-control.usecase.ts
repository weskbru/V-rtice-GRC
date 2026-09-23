import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ControlRepositoryPort } from '../domain/ports/control-repository.port';

import type { ControlRecord } from '../domain/ports/control-repository.port';

export interface GetControlInput {
  readonly actorUserId: string;
  readonly controlId: string;
}

@Injectable()
export class GetControlUseCase {
  constructor(
    private readonly controlRepository: ControlRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: GetControlInput): Promise<ControlRecord> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const referenceDate = new Date();

    const record = await this.controlRepository.findById(scope, input.controlId, referenceDate);
    if (!record) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.CONTROL,
          entityId: input.controlId,
          entityLabel: USER_MESSAGES.controls.entityLabel,
        },
        () => this.controlRepository.findOrgUnitIdUnscoped(input.controlId),
      );
    }

    return record;
  }
}
