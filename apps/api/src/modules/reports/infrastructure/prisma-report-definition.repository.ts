import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ReportDefinitionRepositoryPort } from '../domain/ports/report-definition-repository.port';

import type {
  CreateReportDefinitionInput,
  ReportDefinitionListPage,
  ReportDefinitionListQuery,
  UpdateReportDefinitionChanges,
} from '../domain/ports/report-definition-repository.port';
import type { ReportDefinitionRecord } from '../domain/report-definition.entity';
import type { Prisma, ReportDefinition } from '@prisma/client';

@Injectable()
export class PrismaReportDefinitionRepository implements ReportDefinitionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ReportDefinitionRecord | undefined> {
    const row = await this.prisma.client.reportDefinition.findUnique({ where: { id } });
    return row ? toReportDefinitionRecord(row) : undefined;
  }

  async list(query: ReportDefinitionListQuery): Promise<ReportDefinitionListPage> {
    const where = query.isActive === undefined ? {} : { isActive: query.isActive };

    const [rows, total] = await Promise.all([
      this.prisma.client.reportDefinition.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.reportDefinition.count({ where }),
    ]);

    return { items: rows.map(toReportDefinitionRecord), total };
  }

  async create(input: CreateReportDefinitionInput): Promise<ReportDefinitionRecord> {
    const row = await this.prisma.client.reportDefinition.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        metricKeys: [...input.metricKeys],
        createdByUserId: input.createdByUserId,
      },
    });
    return toReportDefinitionRecord(row);
  }

  async update(
    id: string,
    changes: UpdateReportDefinitionChanges,
  ): Promise<ReportDefinitionRecord | undefined> {
    const data: Prisma.ReportDefinitionUncheckedUpdateManyInput = {};
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.metricKeys !== undefined) data.metricKeys = [...changes.metricKeys];
    if (changes.isActive !== undefined) data.isActive = changes.isActive;

    const result = await this.prisma.client.reportDefinition.updateMany({
      where: { id },
      data,
    });
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(id);
  }
}

function toReportDefinitionRecord(row: ReportDefinition): ReportDefinitionRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    metricKeys: row.metricKeys,
    isActive: row.isActive,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
