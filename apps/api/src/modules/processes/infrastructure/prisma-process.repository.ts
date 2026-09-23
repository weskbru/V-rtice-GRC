import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import { ProcessScopedRepository } from './process-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  CreateProcessRecordInput,
  ProcessListFilter,
  ProcessListResult,
  ProcessListSort,
  ProcessRecord,
  ProcessRepositoryPort,
  ProcessSummaryRecord,
  UpdateProcessChanges,
} from '../domain/ports/process-repository.port';
import type { Prisma } from '@prisma/client';

const DESCRIPTION_EXCERPT_LENGTH = 200;

const PROCESS_INCLUDE = {
  orgUnit: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ProcessInclude;

type ProcessWithRelations = Prisma.ProcessGetPayload<{ include: typeof PROCESS_INCLUDE }>;

@Injectable()
export class PrismaProcessRepository
  extends ProcessScopedRepository
  implements ProcessRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateProcessRecordInput): Promise<ProcessRecord> {
    const created = await this.prisma.client.process.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        orgUnitId: input.orgUnitId,
      },
      include: PROCESS_INCLUDE,
    });
    return this.toProcessRecord(created, [], []);
  }

  async findById(scope: ScopeFilter, id: string): Promise<ProcessRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.process.findFirst({ where, include: PROCESS_INCLUDE }),
    );
    if (!row) {
      return undefined;
    }

    const [riskLinks, controlLinks] = await Promise.all([
      this.prisma.client.riskProcessLink.findMany({
        where: { processId: row.id, unlinkedAt: null },
        select: { risk: { select: { id: true, code: true, title: true } } },
      }),
      this.prisma.client.controlProcessLink.findMany({
        where: { processId: row.id, unlinkedAt: null },
        select: { control: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    return this.toProcessRecord(
      row,
      riskLinks.map((link) => link.risk),
      controlLinks.map((link) => link.control),
    );
  }

  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.process.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }

  async update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateProcessChanges,
  ): Promise<ProcessRecord | undefined> {
    const data: Prisma.ProcessUncheckedUpdateManyInput = {};
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.orgUnitId !== undefined) data.orgUnitId = changes.orgUnitId;

    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.process.updateMany({ where, data }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async deactivate(scope: ScopeFilter, id: string): Promise<ProcessRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.process.updateMany({ where, data: { isActive: false } }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async reactivate(scope: ScopeFilter, id: string): Promise<ProcessRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.process.updateMany({ where, data: { isActive: true } }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async list(
    scope: ScopeFilter,
    filter: ProcessListFilter,
    sort: ProcessListSort,
    page: number,
    pageSize: number,
  ): Promise<ProcessListResult> {
    const where: Prisma.ProcessWhereInput = {};
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.q) {
      where.OR = [
        { code: { contains: filter.q, mode: 'insensitive' } },
        { name: { contains: filter.q, mode: 'insensitive' } },
      ];
    }
    if (filter.orgUnitId && filter.orgUnitId.length > 0) {
      where.orgUnitId = { in: Array.from(filter.orgUnitId) };
    }

    const scopedWhere = this.combineOrgUnitScope(scope, where, filter.orgUnitId);

    const orderBy: Prisma.ProcessOrderByWithRelationInput[] = [
      { [sort.field]: sort.direction },
      { code: 'asc' },
    ];

    const [rows, total] = await Promise.all([
      this.prisma.client.process.findMany({
        where: scopedWhere,
        include: PROCESS_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.process.count({ where: scopedWhere }),
    ]);

    return { items: rows.map((row) => this.toSummaryRecord(row)), total };
  }

  private combineOrgUnitScope(
    scope: ScopeFilter,
    where: Prisma.ProcessWhereInput,
    requestedOrgUnitId: readonly string[] | undefined,
  ): Prisma.ProcessWhereInput {
    if (scope.kind === 'GLOBAL') {
      return where;
    }
    if (requestedOrgUnitId && requestedOrgUnitId.length > 0) {
      const intersection = requestedOrgUnitId.filter((id) => scope.unitIds.has(id));
      return { ...where, orgUnitId: { in: intersection } };
    }
    return this.applyScope(scope, where);
  }

  private toSummaryRecord(row: ProcessWithRelations): ProcessSummaryRecord {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      descriptionExcerpt: row.description
        ? row.description.slice(0, DESCRIPTION_EXCERPT_LENGTH)
        : null,
      orgUnit: row.orgUnit ?? undefined,
      isActive: row.isActive,
      updatedAt: row.updatedAt,
    };
  }

  private toProcessRecord(
    row: ProcessWithRelations,
    risks: readonly { readonly id: string; readonly code: string; readonly title: string }[],
    controls: readonly { readonly id: string; readonly code: string; readonly name: string }[],
  ): ProcessRecord {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? undefined,
      orgUnit: row.orgUnit ?? undefined,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      risks,
      controls,
    };
  }
}
