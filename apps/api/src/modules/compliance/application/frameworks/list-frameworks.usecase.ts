/**
 * T021/004-compliance-management — `ListFrameworksUseCase`: the read side
 * of `GET /frameworks` (`listFrameworks` operation). No scope predicate
 * (research.md D-2) — every caller with `compliance:view` sees every
 * framework.
 */
import { Injectable } from '@nestjs/common';

import { FrameworkRepositoryPort } from '../../domain/ports/framework-repository.port';

import type {
  FrameworkListFilters,
  FrameworkListPage,
  FrameworkListSortDirection,
  FrameworkListSortField,
} from '../../domain/ports/framework-repository.port';

export interface ListFrameworksInput {
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string | undefined;
  readonly origin?: FrameworkListFilters['origin'];
  readonly sortField: FrameworkListSortField;
  readonly sortDirection: FrameworkListSortDirection;
}

@Injectable()
export class ListFrameworksUseCase {
  constructor(private readonly frameworkRepository: FrameworkRepositoryPort) {}

  async execute(input: ListFrameworksInput): Promise<FrameworkListPage> {
    return this.frameworkRepository.list({
      page: input.page,
      pageSize: input.pageSize,
      filters: { q: input.q, origin: input.origin },
      sortField: input.sortField,
      sortDirection: input.sortDirection,
    });
  }
}
