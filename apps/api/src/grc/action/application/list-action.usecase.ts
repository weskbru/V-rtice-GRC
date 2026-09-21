/**
 * T051/002-shared-grc-foundation, US2 — `ListActionUseCase` (`listActions`,
 * FR-014, SC-002, SC-010). Scoped register listing, mirroring
 * `grc/evidence/application/list-evidence.usecase.ts`'s shape.
 *
 * `responsibleUserId` plus `overdue` is "Minhas ações" atrasadas (SC-002);
 * `originType` plus `originId` is "the work arising from this record" — the
 * risk detail screen's own future consumer. `overdue` is never a stored
 * column: `ActionRepositoryPort.list`'s `overdue` filter applies the SAME
 * `status ∈ {OPEN, IN_PROGRESS} AND dueOn < today` predicate
 * `isActionOverdue` computes on read (documented parity, R-006).
 *
 * ## Scope is decided by each origin's CURRENT unit, not `Action.orgUnitId`
 *
 * Assurance fix (Fix 1, confirmed breach): this use case used to hand its
 * own `ScopeFilter` straight to `ActionRepositoryPort.list`, which applied
 * it to `Action.orgUnitId` — a creation-time snapshot that goes stale the
 * moment the origin (e.g. a `Risk`) is later reassigned to a different
 * unit, exactly the staleness `GetActionUseCase`/`UpdateActionUseCase`/
 * `TransitionActionUseCase` already stopped trusting (see
 * `assert-action-origin-in-scope.ts`'s header). A custodian who lost scope
 * over the origin could still SEE the action in a list — its code and
 * title — even though direct access on it correctly 404'd. `resolveOrigin
 * ScopeRestriction` below replaces that with a restriction built from each
 * relevant origin type's LIVE unit instead — see its own doc comment for
 * the query-cost reasoning (a small, fixed number of extra queries, never
 * one per listed row).
 */
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
  /** ISO `YYYY-MM-DD`. */
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

  /**
   * Assurance fix (Fix 1, confirmed breach) — builds `ActionRepositoryPort
   * .list`'s scope restriction from each relevant origin type's CURRENT
   * unit, never from `Action.orgUnitId`'s stale creation-time snapshot.
   * See `ActionOriginScopeRestriction`'s own doc comment for the full
   * reasoning and `ActionOriginAccessor.listOriginIdsInScope`'s for why
   * this stays a small, fixed number of queries (one per relevant origin
   * type) rather than one per listed row.
   *
   * `GLOBAL` scope short-circuits to `UNRESTRICTED` — every origin id is
   * trivially in scope, so no origin type's table is queried at all. For a
   * `UNIT` scope, only the origin type the caller explicitly filtered on
   * (`originType`) is resolved when present; otherwise every REGISTERED
   * type is (`listRegisteredActionOriginTypes`), since an unfiltered list
   * may return actions of any of them.
   */
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
