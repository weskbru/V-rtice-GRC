import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { OVERDUE_ELIGIBLE_ACTION_STATUSES } from '../../shared/domain/overdue.service';

import { FindingScopedRepository } from './finding-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  CloseFindingChanges,
  CreateFindingRecordInput,
  FindingListFilter,
  FindingPageResult,
  FindingRecord,
  FindingRepositoryPort,
  UpdateFindingChanges,
} from '../domain/ports/finding-repository.port';
import type { ActionStatus, Prisma } from '@prisma/client';

const FINDING_INCLUDE = {
  orgUnit: { select: { id: true, name: true } },
  ownerUser: { select: { id: true, fullName: true } },
} satisfies Prisma.FindingInclude;

type FindingWithRelations = Prisma.FindingGetPayload<{ include: typeof FINDING_INCLUDE }>;

const OPEN_ACTION_STATUSES: readonly ActionStatus[] = OVERDUE_ELIGIBLE_ACTION_STATUSES;

@Injectable()
export class PrismaFindingRepository
  extends FindingScopedRepository
  implements FindingRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateFindingRecordInput): Promise<FindingRecord> {
    const created = await this.prisma.client.finding.create({
      data: {
        code: input.code,
        orgUnitId: input.orgUnitId,
        title: input.title,
        description: input.description,
        recommendation: input.recommendation ?? null,
        category: input.category,
        origin: input.origin,
        severity: input.severity,
        priority: input.priority,
        ownerUserId: input.ownerUserId,
        identifiedOn: input.identifiedOn,
        auditEngagementId: input.auditEngagementId ?? null,
      },
      include: FINDING_INCLUDE,
    });
    return this.toFindingRecord(created);
  }

  async findById(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.findFirst({ where, include: FINDING_INCLUDE }),
    );
    return row ? this.toFindingRecord(row) : undefined;
  }

  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.finding.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }

  async listIdsInScope(scope: ScopeFilter): Promise<readonly string[]> {
    const rows = await this.withScope(scope, {}, (where) =>
      this.prisma.client.finding.findMany({ where, select: { id: true } }),
    );
    return rows.map((row) => row.id);
  }

  async update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateFindingChanges,
  ): Promise<FindingRecord | undefined> {
    const data: Prisma.FindingUncheckedUpdateManyInput = {};
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.recommendation !== undefined) data.recommendation = changes.recommendation;
    if (changes.category !== undefined) data.category = changes.category;
    if (changes.severity !== undefined) data.severity = changes.severity;
    if (changes.priority !== undefined) data.priority = changes.priority;
    if (changes.ownerUserId !== undefined) data.ownerUserId = changes.ownerUserId;

    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.updateMany({ where, data }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async close(
    scope: ScopeFilter,
    id: string,
    changes: CloseFindingChanges,
  ): Promise<FindingRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.updateMany({
        where,
        data: {
          status: 'CLOSED',
          closedAt: changes.closedAt,
          closedByUserId: changes.closedByUserId,
          closureJustification: changes.closureJustification,
        },
      }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async reopen(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.updateMany({
        where,
        data: {
          status: 'IN_REMEDIATION',
          closedAt: null,
          closedByUserId: null,
          closureJustification: null,
        },
      }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async startRemediation(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.updateMany({
        where,
        data: { status: 'IN_REMEDIATION' },
      }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async archive(
    scope: ScopeFilter,
    id: string,
    archivedByUserId: string,
    archivedAt: Date,
  ): Promise<FindingRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.finding.updateMany({
        where,
        data: { status: 'ARCHIVED', archivedAt, archivedByUserId },
      }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async findCompletedLinkedActionResponsibles(findingId: string): Promise<readonly string[]> {
    const rows = await this.prisma.client.action.findMany({
      where: { originType: 'FINDING', originId: findingId, status: 'COMPLETED' },
      select: { responsibleUserId: true },
    });
    return rows.map((row) => row.responsibleUserId);
  }

  async list(
    scope: ScopeFilter,
    filter: FindingListFilter,
    page: number,
    pageSize: number,
  ): Promise<FindingPageResult> {
    const where: Prisma.FindingWhereInput = {};
    if (filter.severity !== undefined) where.severity = filter.severity;
    if (filter.ownerUserId !== undefined) where.ownerUserId = filter.ownerUserId;
    if (filter.orgUnitId !== undefined) where.orgUnitId = filter.orgUnitId;
    if (filter.auditEngagementId !== undefined) where.auditEngagementId = filter.auditEngagementId;

    if (filter.withoutRemediation) {
      const originsWithActions = await this.prisma.client.action.findMany({
        where: { originType: 'FINDING' },
        select: { originId: true },
        distinct: ['originId'],
      });
      where.status = filter.status !== undefined && filter.status !== 'OPEN' ? { in: [] } : 'OPEN';
      if (originsWithActions.length > 0) {
        where.id = { notIn: originsWithActions.map((row) => row.originId) };
      }
    } else if (filter.status !== undefined) {
      where.status = filter.status;
    }

    const scopedWhere = this.applyScope(scope, where);

    const [rows, total] = await Promise.all([
      this.prisma.client.finding.findMany({
        where: scopedWhere,
        include: FINDING_INCLUDE,
        orderBy: [{ identifiedOn: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.finding.count({ where: scopedWhere }),
    ]);

    const items = await Promise.all(rows.map((row) => this.toFindingRecord(row)));

    return { items, page, pageSize, total };
  }

  private async toFindingRecord(row: FindingWithRelations): Promise<FindingRecord> {
    const [openActionCount, evidenceCount] = await Promise.all([
      this.prisma.client.action.count({
        where: {
          originType: 'FINDING',
          originId: row.id,
          status: { in: [...OPEN_ACTION_STATUSES] },
        },
      }),
      this.prisma.client.evidenceLink.count({
        where: { subjectType: 'FINDING', subjectId: row.id, unlinkedAt: null },
      }),
    ]);

    return {
      id: row.id,
      code: row.code,
      orgUnit: { id: row.orgUnit.id, name: row.orgUnit.name },
      title: row.title,
      description: row.description,
      recommendation: row.recommendation ?? undefined,
      category: row.category,
      origin: row.origin,
      severity: row.severity,
      priority: row.priority,
      owner: { id: row.ownerUser.id, fullName: row.ownerUser.fullName },
      identifiedOn: row.identifiedOn,
      status: row.status,
      openActionCount,
      evidenceCount,
      closedAt: row.closedAt ?? undefined,
      closedByUserId: row.closedByUserId ?? undefined,
      closureJustification: row.closureJustification ?? undefined,
      archivedAt: row.archivedAt ?? undefined,
      archivedByUserId: row.archivedByUserId ?? undefined,
      auditEngagementId: row.auditEngagementId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
