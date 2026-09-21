/**
 * T018/006-assets-processes — `GetProcessUseCase`: identical in shape to
 * `modules/assets/application/get-asset.usecase.ts` (FR-020).
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ProcessRepositoryPort } from '../domain/ports/process-repository.port';

import type { ProcessRecord } from '../domain/ports/process-repository.port';

export interface GetProcessInput {
  readonly actorUserId: string;
  readonly processId: string;
}

@Injectable()
export class GetProcessUseCase {
  constructor(
    private readonly processRepository: ProcessRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: GetProcessInput): Promise<ProcessRecord> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const record = await this.processRepository.findById(scope, input.processId);
    if (!record) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.PROCESS,
          entityId: input.processId,
          entityLabel: USER_MESSAGES.processes.entityLabel,
        },
        () => this.processRepository.findOrgUnitIdUnscoped(input.processId),
      );
    }

    return record;
  }
}
