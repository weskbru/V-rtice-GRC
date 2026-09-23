import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ControlQueryPort } from '../domain/ports/control-query.port';

import type { ControlEffectiveness } from '../domain/control-effectiveness.service';
import type {
  ControlCatalogRow,
  ControlCatalogSortDirection,
  ControlCatalogSortField,
} from '../domain/ports/control-query.port';
import type { ControlFrequency, ControlNature, ControlStatus, ControlType } from '@prisma/client';

export interface ListControlsInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string | undefined;
  readonly status?: readonly ControlStatus[] | undefined;
  readonly effectiveness?: readonly ControlEffectiveness[] | undefined;
  readonly nature?: readonly ControlNature[] | undefined;
  readonly type?: readonly ControlType[] | undefined;
  readonly frequency?: readonly ControlFrequency[] | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly ownerUserId?: readonly string[] | undefined;
  readonly sortField: ControlCatalogSortField;
  readonly sortDirection: ControlCatalogSortDirection;
}

export interface ListControlsOutput {
  readonly items: readonly ControlCatalogRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

@Injectable()
export class ListControlsUseCase {
  constructor(
    private readonly controlQuery: ControlQueryPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListControlsInput): Promise<ListControlsOutput> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const { items, total } = await this.controlQuery.listCatalog({
      scope,
      filters: {
        q: input.q,
        status: input.status,
        effectiveness: input.effectiveness,
        nature: input.nature,
        type: input.type,
        frequency: input.frequency,
        orgUnitId: input.orgUnitId,
        ownerUserId: input.ownerUserId,
      },
      sort: { field: input.sortField, direction: input.sortDirection },
      page: input.page,
      pageSize: input.pageSize,
      referenceDate: new Date(),
    });

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
    };
  }
}
