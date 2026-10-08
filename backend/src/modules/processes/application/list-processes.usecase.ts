import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ProcessRepositoryPort } from '../domain/ports/process-repository.port';

import type {
  ProcessCatalogSortDirection,
  ProcessCatalogSortField,
  ProcessSummaryRecord,
} from '../domain/ports/process-repository.port';

export interface ListProcessesInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly isActive?: boolean | undefined;
  readonly sortField: ProcessCatalogSortField;
  readonly sortDirection: ProcessCatalogSortDirection;
}

export interface ListProcessesOutput {
  readonly items: readonly ProcessSummaryRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

@Injectable()
export class ListProcessesUseCase {
  constructor(
    private readonly processRepository: ProcessRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListProcessesInput): Promise<ListProcessesOutput> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const { items, total } = await this.processRepository.list(
      scope,
      { q: input.q, orgUnitId: input.orgUnitId, isActive: input.isActive },
      { field: input.sortField, direction: input.sortDirection },
      input.page,
      input.pageSize,
    );

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
    };
  }
}
