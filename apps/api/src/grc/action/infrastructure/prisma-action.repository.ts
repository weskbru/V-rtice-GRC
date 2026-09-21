/**
 * T050/002-shared-grc-foundation, US2 — `PrismaActionRepository`, the sole
 * implementation of `ActionRepositoryPort`. Extends `ActionScopedRepository`
 * (T013), which fixes `applyScope`/`withScope` to `orgUnitId` — every
 * scoped method below is compile-time required to thread the caller's
 * `ScopeFilter` through it (FR-031/FR-032), the same guarantee
 * `PrismaEvidenceRepository` gets from its own base.
 *
 * `findByIdUnscoped`/`mirrorTransition` deliberately bypass
 * `applyScope`/`withScope` — see the port's own doc comments for why (the
 * `RISK_TREATMENT` convergence's already-authorized internal caller).
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  OVERDUE_ELIGIBLE_ACTION_STATUSES,
  todayDateOnlyUtc,
} from '../../shared/domain/overdue.service';

import { ActionScopedRepository } from './action-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  ActionListFilter,
  ActionOriginScopeRestriction,
  ActionPageResult,
  ActionRecord,
  ActionRepositoryPort,
  ActionTransitionChanges,
  CreateActionRecordInput,
  UpdateActionChanges,
} from '../domain/ports/action-repository.port';
import type { ActionStatus, Prisma } from '@prisma/client';

// Exported (007-implementation-remediation, Frente A) so
// `modules/risk/infrastructure/risk-treatment-action-query.service.ts` can
// build the exact same `ActionRecord` shape for a risk's treatment-action
// listing (which reads `actions` directly by origin, D-7) without
// duplicating this mapping — the ONE place an `Action` row becomes an
// `ActionRecord`.
export const ACTION_INCLUDE = {
  orgUnit: { select: { id: true, name: true } },
  responsibleUser: { select: { id: true, fullName: true } },
} satisfies Prisma.ActionInclude;

export type ActionWithRelations = Prisma.ActionGetPayload<{ include: typeof ACTION_INCLUDE }>;

export function toActionRecord(row: ActionWithRelations): ActionRecord {
  return {
    id: row.id,
    code: row.code,
    orgUnit: { id: row.orgUnit.id, name: row.orgUnit.name },
    originType: row.originType,
    originId: row.originId,
    title: row.title,
    description: row.description ?? undefined,
    responsible: { id: row.responsibleUser.id, fullName: row.responsibleUser.fullName },
    dueOn: row.dueOn,
    status: row.status,
    completedAt: row.completedAt ?? undefined,
    completedByUserId: row.completedByUserId ?? undefined,
    reopenedAt: row.reopenedAt ?? undefined,
    reopenedByUserId: row.reopenedByUserId ?? undefined,
    reopenReason: row.reopenReason ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Shared by `transition`/`mirrorTransition` below — both apply the exact
 * same set of columns via `updateMany` (which takes scalar FK fields
 * directly, not Prisma's relation `connect`/`disconnect` syntax). */
function toTransitionUpdateManyData(
  changes: ActionTransitionChanges,
): Prisma.ActionUncheckedUpdateManyInput {
  return {
    status: changes.status,
    completedAt: changes.completedAt,
    completedByUserId: changes.completedByUserId,
    reopenedAt: changes.reopenedAt,
    reopenedByUserId: changes.reopenedByUserId,
    reopenReason: changes.reopenReason,
  };
}

/** Shared by `update`/`mirrorFieldUpdate` — both apply the SAME field-edit
 * column set (`title`/`description`/`responsibleUserId`/`dueOn`), the
 * scoped, controller-facing write and the unscoped `RISK_TREATMENT`
 * convergence mirror (Fix 2) respectively. `undefined` means "leave
 * unchanged" per `UpdateActionChanges`'s own convention. */
function toFieldUpdateManyData(
  changes: UpdateActionChanges,
): Prisma.ActionUncheckedUpdateManyInput {
  const data: Prisma.ActionUncheckedUpdateManyInput = {};
  if (changes.title !== undefined) data.title = changes.title;
  if (changes.description !== undefined) data.description = changes.description;
  if (changes.responsibleUserId !== undefined) data.responsibleUserId = changes.responsibleUserId;
  if (changes.dueOn !== undefined) data.dueOn = changes.dueOn;
  return data;
}

@Injectable()
export class PrismaActionRepository extends ActionScopedRepository implements ActionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateActionRecordInput): Promise<ActionRecord> {
    const created = await this.prisma.client.action.create({
      data: {
        code: input.code,
        orgUnitId: input.orgUnitId,
        originType: input.originType,
        originId: input.originId,
        title: input.title,
        description: input.description ?? null,
        responsibleUserId: input.responsibleUserId,
        dueOn: input.dueOn,
      },
      include: ACTION_INCLUDE,
    });
    return toActionRecord(created);
  }

  async findById(scope: ScopeFilter, id: string): Promise<ActionRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.action.findFirst({ where, include: ACTION_INCLUDE }),
    );
    return row ? toActionRecord(row) : undefined;
  }

  async findByIdUnscoped(id: string): Promise<ActionRecord | undefined> {
    const row = await this.prisma.client.action.findUnique({
      where: { id },
      include: ACTION_INCLUDE,
    });
    return row ? toActionRecord(row) : undefined;
  }

  async update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateActionChanges,
  ): Promise<ActionRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.action.updateMany({ where, data: toFieldUpdateManyData(changes) }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async transition(
    scope: ScopeFilter,
    id: string,
    changes: ActionTransitionChanges,
  ): Promise<ActionRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.action.updateMany({ where, data: toTransitionUpdateManyData(changes) }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async mirrorTransition(
    id: string,
    changes: ActionTransitionChanges,
  ): Promise<ActionRecord | undefined> {
    const result = await this.prisma.client.action.updateMany({
      where: { id },
      data: toTransitionUpdateManyData(changes),
    });
    if (result.count === 0) {
      return undefined;
    }
    return this.findByIdUnscoped(id);
  }

  /** Assurance fix (Fix 2) — the field-edit counterpart to `mirrorTransition`
   * above; see `ActionRepositoryPort.mirrorFieldUpdate`'s own doc comment. */
  async mirrorFieldUpdate(
    id: string,
    changes: UpdateActionChanges,
  ): Promise<ActionRecord | undefined> {
    const result = await this.prisma.client.action.updateMany({
      where: { id },
      data: toFieldUpdateManyData(changes),
    });
    if (result.count === 0) {
      return undefined;
    }
    return this.findByIdUnscoped(id);
  }

  async list(
    restriction: ActionOriginScopeRestriction,
    filter: ActionListFilter,
    page: number,
    pageSize: number,
  ): Promise<ActionPageResult> {
    const where: Prisma.ActionWhereInput = {};
    if (filter.responsibleUserId !== undefined) where.responsibleUserId = filter.responsibleUserId;
    if (filter.originType !== undefined) where.originType = filter.originType;
    if (filter.originId !== undefined) where.originId = filter.originId;
    if (filter.orgUnitId !== undefined) where.orgUnitId = filter.orgUnitId;
    if (filter.dueBefore !== undefined) where.dueOn = { lt: filter.dueBefore };

    // `status`/`statuses`/`overdue` are AND-combined, never one silently
    // overriding the other (mirrors `risk-treatment-action.repository.ts
    // #buildWhere`'s own documented reasoning: `status=COMPLETED&overdue=true`
    // must return zero rows, not silently ignore one filter). Coordinator
    // correction, 007-implementation-remediation, Frente A: this used to be
    // its OWN local copy of `grc/shared/domain/overdue.service.ts`'s
    // status set, with a comment saying the two "must" stay in sync —
    // exactly the unenforced duplication that comment described rather
    // than prevented. Now imported directly; there is nothing left to keep
    // in sync by hand. `status` and `statuses` are mutually exclusive by
    // convention (ActionListFilter's own doc comment); when both are
    // absent, no status predicate is applied outside `overdue`.
    const requestedStatuses: readonly ActionStatus[] | undefined =
      filter.statuses ?? (filter.status !== undefined ? [filter.status] : undefined);
    if (filter.overdue) {
      where.dueOn = { lt: filter.dueBefore ?? todayDateOnlyUtc() };
      where.status =
        requestedStatuses !== undefined
          ? { in: requestedStatuses.filter((s) => OVERDUE_ELIGIBLE_ACTION_STATUSES.includes(s)) }
          : { in: [...OVERDUE_ELIGIBLE_ACTION_STATUSES] };
    } else if (requestedStatuses !== undefined) {
      // `{ in: [...] }` also covers the single-value case correctly in
      // Prisma — avoids an indexed access TypeScript cannot narrow past
      // `exactOptionalPropertyTypes` even after a length check.
      where.status = { in: [...requestedStatuses] };
    }

    // Assurance fix (Fix 1) — `Action.orgUnitId`'s stale snapshot is never
    // consulted here. `restriction` was built by `ListActionUseCase` from
    // each relevant origin type's LIVE org unit (`ActionOriginAccessor
    // .listOriginIdsInScope`); `UNRESTRICTED` (the actor's own scope is
    // `GLOBAL`) applies no extra predicate at all, `RESTRICTED` becomes one
    // `originType = X AND originId IN (...)` group per type, OR'd together.
    // An empty `allowedOriginIdsByType` (no registered origin type was
    // evaluated — e.g. every one returned zero ids) must match NOTHING, not
    // "no filter" — `id: { in: [] }` says that explicitly rather than
    // relying on Prisma's own empty-`OR`-array behaviour.
    let scopedWhere: Prisma.ActionWhereInput = where;
    if (restriction.kind === 'RESTRICTED') {
      const originGroups = [...restriction.allowedOriginIdsByType.entries()]
        .filter(([, ids]) => ids.length > 0)
        .map(([originType, ids]) => ({ originType, originId: { in: [...ids] } }));
      scopedWhere =
        originGroups.length > 0 ? { ...where, OR: originGroups } : { ...where, id: { in: [] } };
    }

    const [rows, total] = await Promise.all([
      this.prisma.client.action.findMany({
        where: scopedWhere,
        include: ACTION_INCLUDE,
        orderBy: [{ dueOn: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.action.count({ where: scopedWhere }),
    ]);

    return {
      items: rows.map(toActionRecord),
      page,
      pageSize,
      total,
    };
  }

  /**
   * 009-indicators-reports, T026 — a single `COUNT(*)`, scoped by
   * `Action.orgUnitId` via `this.applyScope` (`ActionScopedRepository`,
   * the SAME base every other scoped method here uses), filtered on the
   * SAME `OVERDUE_ELIGIBLE_ACTION_STATUSES` array `isActionOverdue`
   * checks — never a second, hand-rolled "is this overdue" rule.
   */
  async countOverdueInScope(scope: ScopeFilter, referenceDate: Date): Promise<number> {
    const where = this.applyScope(scope, {
      status: { in: [...OVERDUE_ELIGIBLE_ACTION_STATUSES] },
      dueOn: { lt: referenceDate },
    });
    return this.prisma.client.action.count({ where });
  }

  /**
   * `GET /dashboard/summary`'s `breakdowns.actions.byStatus` — one
   * `GROUP BY status` query, scoped by `this.applyScope`, zero-filled for
   * every `ActionStatus` afterward (a status with zero rows is never
   * simply absent from Prisma's own `groupBy` result).
   */
  async getStatusBreakdown(scope: ScopeFilter): Promise<Readonly<Record<ActionStatus, number>>> {
    const where = this.applyScope(scope, {});
    const rows = await this.prisma.client.action.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    const byStatus: Record<ActionStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const row of rows) {
      byStatus[row.status] = row._count._all;
    }
    return byStatus;
  }

  /**
   * `GET /dashboard/summary`'s `breakdowns.actions.dueSoon` — the SAME
   * `OVERDUE_ELIGIBLE_ACTION_STATUSES` filter `countOverdueInScope` uses
   * above, with `dueOn` bounded by `[fromInclusive, toExclusive)` instead
   * of `< referenceDate` — never a second "which statuses can still be
   * due" rule.
   */
  async countDueSoonInScope(
    scope: ScopeFilter,
    fromInclusive: Date,
    toExclusive: Date,
  ): Promise<number> {
    const where = this.applyScope(scope, {
      status: { in: [...OVERDUE_ELIGIBLE_ACTION_STATUSES] },
      dueOn: { gte: fromInclusive, lt: toExclusive },
    });
    return this.prisma.client.action.count({ where });
  }
}
