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

    const requestedStatuses: readonly ActionStatus[] | undefined =
      filter.statuses ?? (filter.status !== undefined ? [filter.status] : undefined);
    if (filter.overdue) {
      where.dueOn = { lt: filter.dueBefore ?? todayDateOnlyUtc() };
      where.status =
        requestedStatuses !== undefined
          ? { in: requestedStatuses.filter((s) => OVERDUE_ELIGIBLE_ACTION_STATUSES.includes(s)) }
          : { in: [...OVERDUE_ELIGIBLE_ACTION_STATUSES] };
    } else if (requestedStatuses !== undefined) {
      where.status = { in: [...requestedStatuses] };
    }

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

  async countOverdueInScope(scope: ScopeFilter, referenceDate: Date): Promise<number> {
    const where = this.applyScope(scope, {
      status: { in: [...OVERDUE_ELIGIBLE_ACTION_STATUSES] },
      dueOn: { lt: referenceDate },
    });
    return this.prisma.client.action.count({ where });
  }

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
