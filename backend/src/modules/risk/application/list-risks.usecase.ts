import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { RiskQueryPort } from '../domain/ports/risk-query.port';

import type {
  RiskLevelBasis,
  RiskRegisterRow,
  RiskRegisterSortDirection,
  RiskRegisterSortField,
} from '../domain/ports/risk-query.port';
import type { RiskLevel, RiskStatus } from '@prisma/client';

export interface ListRisksInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string | undefined;
  readonly status?: readonly RiskStatus[] | undefined;
  readonly riskLevel?: readonly RiskLevel[] | undefined;
  readonly riskLevelBasis: RiskLevelBasis;
  readonly categoryId?: readonly string[] | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly includeDescendants: boolean;
  readonly ownerUserId?: readonly string[] | undefined;
  readonly overdueReview?: boolean | undefined;
  readonly overdueTreatment?: boolean | undefined;
  readonly sortField: RiskRegisterSortField;
  readonly sortDirection: RiskRegisterSortDirection;
}

export interface ListRisksOutput {
  readonly items: readonly RiskRegisterRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

@Injectable()
export class ListRisksUseCase {
  constructor(
    private readonly riskQuery: RiskQueryPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListRisksInput): Promise<ListRisksOutput> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const { items, total } = await this.riskQuery.listRegister({
      scope,
      filters: {
        q: input.q,
        status: input.status,
        riskLevel: input.riskLevel,
        riskLevelBasis: input.riskLevelBasis,
        categoryId: input.categoryId,
        orgUnitId: input.orgUnitId,
        includeDescendants: input.includeDescendants,
        ownerUserId: input.ownerUserId,
        overdueReview: input.overdueReview,
        overdueTreatment: input.overdueTreatment,
      },
      sort: { field: input.sortField, direction: input.sortDirection },
      page: input.page,
      pageSize: input.pageSize,
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
