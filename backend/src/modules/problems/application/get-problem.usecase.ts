import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ProblemRepositoryPort } from '../domain/ports/problem-repository.port';

import type { ProblemRecord } from '../domain/ports/problem-repository.port';

export interface GetProblemInput {
  readonly actorUserId: string;
  readonly problemId: string;
}

@Injectable()
export class GetProblemUseCase {
  constructor(
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: GetProblemInput): Promise<ProblemRecord> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const record = await this.problemRepository.findById(scope, input.problemId);
    if (!record) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.PROBLEM,
          entityId: input.problemId,
          entityLabel: USER_MESSAGES.problems.entityLabel,
        },
        () => this.problemRepository.findOrgUnitIdUnscoped(input.problemId),
      );
    }

    return record;
  }
}
