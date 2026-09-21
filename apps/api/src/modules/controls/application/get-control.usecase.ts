/**
 * T020/003-controls-management — `GetControlUseCase`: the read side of
 * `GET /controls/{controlId}` (`getControl` operation, FR-007, FR-003).
 * Mirrors `modules/risk/application/get-risk.usecase.ts` exactly — no
 * transaction, no audit entry (a read is never audited, ADR-005); a scope
 * denial IS recorded, via `OrgScopeEnforcerService
 * .assertExistingRecordAccessible` (F-38's mechanism), whenever the control
 * genuinely exists outside the caller's scope.
 */
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

    // FR-007/FR-030: a control outside scope reads as `undefined`, mapped
    // to the same 404 as "does not exist" — never surfaced to the caller.
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
