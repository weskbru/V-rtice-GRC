/**
 * 008-incidents-problems, US2 — `ListProblemsUseCase`: `GET /problems`
 * (`listProblems` operation, spec.md FR-014). Always paginated, always
 * scoped — mirrors `modules/controls/application/list-controls.usecase.ts`'s
 * structure.
 */
import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ProblemRepositoryPort } from '../domain/ports/problem-repository.port';

import type {
  ProblemListPage,
  ProblemListSortField,
} from '../domain/ports/problem-repository.port';
import type { ProblemSeverity, ProblemStatus } from '@prisma/client';

export interface ListProblemsInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: readonly ProblemStatus[] | undefined;
  readonly severity?: readonly ProblemSeverity[] | undefined;
  readonly search?: string | undefined;
  readonly orgUnitId?: string | undefined;
  readonly sort: ProblemListSortField;
  readonly direction: 'asc' | 'desc';
}

@Injectable()
export class ListProblemsUseCase {
  constructor(
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListProblemsInput): Promise<ProblemListPage> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    return this.problemRepository.list(
      scope,
      {
        status: input.status,
        severity: input.severity,
        search: input.search,
        orgUnitId: input.orgUnitId,
      },
      input.page,
      input.pageSize,
      input.sort,
      input.direction,
    );
  }
}
