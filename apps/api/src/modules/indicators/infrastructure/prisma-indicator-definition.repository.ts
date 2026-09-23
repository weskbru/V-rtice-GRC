import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  IndicatorDefinitionRepositoryPort,
  type CreateIndicatorDefinitionInput,
  type IndicatorDefinitionListPage,
  type IndicatorDefinitionListQuery,
  type UpdateIndicatorDefinitionChanges,
} from '../domain/ports/indicator-definition-repository.port';

import type { IndicatorDefinitionRecord } from '../domain/indicator-definition.entity';
import type { IndicatorDefinition, IndicatorMetricKey, Prisma } from '@prisma/client';

@Injectable()
export class PrismaIndicatorDefinitionRepository implements IndicatorDefinitionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<IndicatorDefinitionRecord | undefined> {
    const row = await this.prisma.client.indicatorDefinition.findUnique({ where: { id } });
    return row ? toIndicatorDefinitionRecord(row) : undefined;
  }

  async findByMetricKey(
    metricKey: IndicatorMetricKey,
  ): Promise<IndicatorDefinitionRecord | undefined> {
    const row = await this.prisma.client.indicatorDefinition.findUnique({ where: { metricKey } });
    return row ? toIndicatorDefinitionRecord(row) : undefined;
  }

  async list(query: IndicatorDefinitionListQuery): Promise<IndicatorDefinitionListPage> {
    const where = query.isActive === undefined ? {} : { isActive: query.isActive };

    const [rows, total] = await Promise.all([
      this.prisma.client.indicatorDefinition.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.indicatorDefinition.count({ where }),
    ]);

    return { items: rows.map(toIndicatorDefinitionRecord), total };
  }

  async create(input: CreateIndicatorDefinitionInput): Promise<IndicatorDefinitionRecord> {
    const row = await this.prisma.client.indicatorDefinition.create({
      data: {
        code: input.code,
        metricKey: input.metricKey,
        name: input.name,
        description: input.description,
        ownerUserId: input.ownerUserId,
        thresholdComparator: input.thresholdComparator,
        thresholdValue: input.thresholdValue,
        createdByUserId: input.createdByUserId,
      },
    });
    return toIndicatorDefinitionRecord(row);
  }

  async update(
    id: string,
    changes: UpdateIndicatorDefinitionChanges,
  ): Promise<IndicatorDefinitionRecord | undefined> {
    const data: Prisma.IndicatorDefinitionUncheckedUpdateManyInput = {};
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.ownerUserId !== undefined) data.ownerUserId = changes.ownerUserId;
    if (changes.thresholdComparator !== undefined) {
      data.thresholdComparator = changes.thresholdComparator;
    }
    if (changes.thresholdValue !== undefined) data.thresholdValue = changes.thresholdValue;
    if (changes.isActive !== undefined) data.isActive = changes.isActive;

    const result = await this.prisma.client.indicatorDefinition.updateMany({
      where: { id },
      data,
    });
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(id);
  }

  async listConfiguredMetricKeys(): Promise<ReadonlySet<IndicatorMetricKey>> {
    const rows = await this.prisma.client.indicatorDefinition.findMany({
      select: { metricKey: true },
    });
    return new Set(rows.map((row) => row.metricKey));
  }

  async listAllIds(): Promise<readonly string[]> {
    const rows = await this.prisma.client.indicatorDefinition.findMany({ select: { id: true } });
    return rows.map((row) => row.id);
  }
}

function toIndicatorDefinitionRecord(row: IndicatorDefinition): IndicatorDefinitionRecord {
  return {
    id: row.id,
    code: row.code,
    metricKey: row.metricKey,
    name: row.name,
    description: row.description,
    ownerUserId: row.ownerUserId,
    thresholdComparator: row.thresholdComparator,
    thresholdValue: row.thresholdValue ? row.thresholdValue.toNumber() : null,
    isActive: row.isActive,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
