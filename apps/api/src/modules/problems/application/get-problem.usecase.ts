/**
 * 008-incidents-problems, US2 — `GetProblemUseCase`: the read side of
 * `GET /problems/{problemId}` (`getProblem` operation, spec.md FR-014).
 * Mirrors `modules/controls/application/get-control.usecase.ts` exactly —
 * no transaction, no audit entry (a read is never audited, ADR-005); a
 * scope denial IS recorded, via `OrgScopeEnforcerService
 * .assertExistingRecordAccessible` (F-38's mechanism), whenever the
 * problem genuinely exists outside the caller's scope.
 */
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

    // FR-014: a problem outside scope reads as `undefined`, mapped to the
    // same 404 as "does not exist" — never surfaced to the caller.
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
