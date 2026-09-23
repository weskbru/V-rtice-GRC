import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IncidentRepositoryPort } from '../domain/ports/incident-repository.port';

import { IncidentScopedRepository } from './incident-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  CreateIncidentRecordInput,
  IncidentListFilter,
  IncidentPageResult,
  IncidentRecord,
  IncidentSortField,
  IncidentTransitionChanges,
  UpdateIncidentChanges,
} from '../domain/ports/incident-repository.port';
import type { Prisma } from '@prisma/client';

const INCIDENT_INCLUDE = {
  orgUnit: { select: { id: true, code: true, name: true } },
  reportedBy: { select: { id: true, fullName: true } },
  owner: { select: { id: true, fullName: true } },
  resolvedByUser: { select: { id: true, fullName: true } },
  closedByUser: { select: { id: true, fullName: true } },
  cancelledByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.IncidentInclude;

type IncidentWithRelations = Prisma.IncidentGetPayload<{ include: typeof INCIDENT_INCLUDE }>;

const SORT_COLUMN: Record<IncidentSortField, keyof Prisma.IncidentOrderByWithRelationInput> = {
  code: 'code',
  title: 'title',
  severity: 'severity',
  status: 'status',
  reportedOn: 'reportedOn',
  updatedAt: 'updatedAt',
};

@Injectable()
export class PrismaIncidentRepository
  extends IncidentScopedRepository
  implements IncidentRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateIncidentRecordInput): Promise<IncidentRecord> {
    const created = await this.prisma.client.incident.create({
      data: {
        code: input.code,
        orgUnitId: input.orgUnitId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        reportedByUserId: input.reportedByUserId,
        ownerUserId: input.ownerUserId,
        reportedOn: input.reportedOn,
      },
      include: INCIDENT_INCLUDE,
    });
    return this.toIncidentRecord(created);
  }

  async findById(scope: ScopeFilter, id: string): Promise<IncidentRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.incident.findFirst({ where, include: INCIDENT_INCLUDE }),
    );
    return row ? this.toIncidentRecord(row) : undefined;
  }

  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.incident.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }

  async update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateIncidentChanges,
  ): Promise<IncidentRecord | undefined> {
    const data: Prisma.IncidentUncheckedUpdateManyInput = {};
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.severity !== undefined) data.severity = changes.severity;
    if (changes.ownerUserId !== undefined) data.ownerUserId = changes.ownerUserId;

    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.incident.updateMany({ where, data }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async transition(
    scope: ScopeFilter,
    id: string,
    changes: IncidentTransitionChanges,
  ): Promise<IncidentRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.incident.updateMany({
        where,
        data: {
          status: changes.status,
          resolutionSummary: changes.resolutionSummary,
          resolvedAt: changes.resolvedAt,
          resolvedByUserId: changes.resolvedByUserId,
          closedAt: changes.closedAt,
          closedByUserId: changes.closedByUserId,
          cancellationReason: changes.cancellationReason,
          cancelledAt: changes.cancelledAt,
          cancelledByUserId: changes.cancelledByUserId,
        },
      }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async list(
    scope: ScopeFilter,
    filter: IncidentListFilter,
    sort: IncidentSortField,
    direction: 'asc' | 'desc',
    page: number,
    pageSize: number,
  ): Promise<IncidentPageResult> {
    const where: Prisma.IncidentWhereInput = {};
    if (filter.status !== undefined && filter.status.length > 0) {
      where.status = { in: [...filter.status] };
    }
    if (filter.severity !== undefined && filter.severity.length > 0) {
      where.severity = { in: [...filter.severity] };
    }
    if (filter.orgUnitId !== undefined) {
      where.orgUnitId = filter.orgUnitId;
    }
    if (filter.search !== undefined && filter.search.trim().length > 0) {
      const term = filter.search.trim();
      where.OR = [
        { code: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
      ];
    }

    const scopedWhere = this.applyScope(scope, where);
    const orderBy: Prisma.IncidentOrderByWithRelationInput[] = [
      { [SORT_COLUMN[sort]]: direction },
      { id: 'asc' },
    ];

    const [rows, total] = await Promise.all([
      this.prisma.client.incident.findMany({
        where: scopedWhere,
        include: INCIDENT_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.incident.count({ where: scopedWhere }),
    ]);

    return { items: rows.map((row) => this.toIncidentRecord(row)), page, pageSize, total };
  }

  private toIncidentRecord(row: IncidentWithRelations): IncidentRecord {
    return {
      id: row.id,
      code: row.code,
      orgUnit: { id: row.orgUnit.id, code: row.orgUnit.code, name: row.orgUnit.name },
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      reportedBy: { id: row.reportedBy.id, fullName: row.reportedBy.fullName },
      owner: { id: row.owner.id, fullName: row.owner.fullName },
      reportedOn: row.reportedOn,
      resolutionSummary: row.resolutionSummary ?? undefined,
      resolvedAt: row.resolvedAt ?? undefined,
      resolvedBy: row.resolvedByUser
        ? { id: row.resolvedByUser.id, fullName: row.resolvedByUser.fullName }
        : undefined,
      closedAt: row.closedAt ?? undefined,
      closedBy: row.closedByUser
        ? { id: row.closedByUser.id, fullName: row.closedByUser.fullName }
        : undefined,
      cancellationReason: row.cancellationReason ?? undefined,
      cancelledAt: row.cancelledAt ?? undefined,
      cancelledBy: row.cancelledByUser
        ? { id: row.cancelledByUser.id, fullName: row.cancelledByUser.fullName }
        : undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
