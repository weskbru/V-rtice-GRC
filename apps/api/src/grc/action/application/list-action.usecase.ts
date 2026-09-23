import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { parseIsoDate } from '../../shared/domain/iso-date';
import { isActionOverdue, todayDateOnlyUtc } from '../../shared/domain/overdue.service';
import {
  getActionOriginAccessor,
  listRegisteredActionOriginTypes,
} from '../../shared/domain/ports/action-origin-resolver.port';
import { ActionRepositoryPort } from '../domain/ports/action-repository.port';

import { ActionOriginLabelService } from './action-origin-label.service';

import type { ActionWithDerived } from './get-action.usecase';
import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ActionOriginScopeRestriction } from '../domain/ports/action-repository.port';
import type { ActionOriginType, ActionStatus } from '@prisma/client';

export interface ListActionInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: ActionStatus | undefined;
  readonly responsibleUserId?: string | undefined;
  readonly originType?: ActionOriginType | undefined;
  readonly originId?: string | undefined;
  readonly overdue?: boolean | undefined;
  readonly dueBefore?: string | undefined;
}

export interface ActionListResult {
  readonly items: readonly ActionWithDerived[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

@Injectable()
export class ListActionUseCase {
  constructor(
    private readonly actionRepository: ActionRepositoryPort,
    private readonly originLabelService: ActionOriginLabelService,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListActionInput): Promise<ActionListResult> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const restriction = await this.resolveOriginScopeRestriction(scope, input.originType);

    const page = await this.actionRepository.list(
      restriction,
      {
        status: input.status,
        responsibleUserId: input.responsibleUserId,
        originType: input.originType,
        originId: input.originId,
        overdue: input.overdue,
        dueBefore: input.dueBefore ? parseIsoDate(input.dueBefore) : undefined,
      },
      input.page,
      input.pageSize,
    );

    const today = todayDateOnlyUtc();
    const items = await Promise.all(
      page.items.map(async (record) => ({
        ...record,
        overdue: isActionOverdue(record.dueOn, record.status, today),
        originLabel: await this.originLabelService.resolveLabel(
          input.actorUserId,
          record.originType,
          record.originId,
        ),
      })),
    );

    return { items, page: page.page, pageSize: page.pageSize, total: page.total };
  }

  private async resolveOriginScopeRestriction(
    scope: ScopeFilter,
    originTypeFilter: ActionOriginType | undefined,
  ): Promise<ActionOriginScopeRestriction> {
    if (scope.kind === 'GLOBAL') {
      return { kind: 'UNRESTRICTED' };
    }

    const originTypes = originTypeFilter ? [originTypeFilter] : listRegisteredActionOriginTypes();
    const entries = await Promise.all(
      originTypes.map(
        async (originType) =>
          [
            originType,
            await getActionOriginAccessor(originType).listOriginIdsInScope(scope),
          ] as const,
      ),
    );

    return { kind: 'RESTRICTED', allowedOriginIdsByType: new Map(entries) };
  }
}
