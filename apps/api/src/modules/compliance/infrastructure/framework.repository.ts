/**
 * T020/004-compliance-management — `FrameworkRepository`: the sole
 * Prisma-backed implementation of `FrameworkRepositoryPort`. No
 * `ScopeFilter` anywhere (research.md D-2) — every method reads/writes
 * `frameworks` unconditionally, gated only by the controller's
 * `@RequirePermission` decorator, exactly like `PrismaRoleRepository`.
 *
 * `updateWithVersion` follows the same conditional `UPDATE ... WHERE id =
 * ? AND version = ?` mechanism `ControlRepository.updateWithVersion`
 * documents (ADR-013), minus the scope predicate.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  FrameworkRepositoryPort,
  type CreateFrameworkInput,
  type FrameworkListPage,
  type FrameworkListQuery,
  type FrameworkUpdateResult,
  type UpdateFrameworkChanges,
} from '../domain/ports/framework-repository.port';

import type { FrameworkRecord } from '../domain/framework.entity';
import type { Prisma } from '@prisma/client';

@Injectable()
export class FrameworkRepository implements FrameworkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateFrameworkInput): Promise<FrameworkRecord> {
    const created = await this.prisma.client.framework.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        origin: input.origin,
      },
    });
    return toFrameworkRecord(created);
  }

  async findById(id: string): Promise<FrameworkRecord | undefined> {
    const row = await this.prisma.client.framework.findUnique({ where: { id } });
    return row ? toFrameworkRecord(row) : undefined;
  }

  async list(query: FrameworkListQuery): Promise<FrameworkListPage> {
    const where: Prisma.FrameworkWhereInput = {};

    if (query.filters.q) {
      where.OR = [
        { code: { contains: query.filters.q, mode: 'insensitive' } },
        { name: { contains: query.filters.q, mode: 'insensitive' } },
      ];
    }
    if (query.filters.origin && query.filters.origin.length > 0) {
      where.origin = { in: Array.from(query.filters.origin) };
    }

    const orderBy: Prisma.FrameworkOrderByWithRelationInput = {
      [query.sortField]: query.sortDirection,
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.framework.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.framework.count({ where }),
    ]);

    return { items: rows.map(toFrameworkRecord), total };
  }

  async updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: UpdateFrameworkChanges,
  ): Promise<FrameworkUpdateResult> {
    const data: Prisma.FrameworkUncheckedUpdateManyInput = { version: { increment: 1 } };
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.origin !== undefined) data.origin = changes.origin;

    const result = await this.prisma.client.framework.updateMany({
      where: { id, version: expectedVersion },
      data,
    });

    if (result.count > 0) {
      const updated = await this.findById(id);
      // Defensive only: a row this same transaction just updated cannot
      // vanish from a `findById` a moment later.
      if (!updated) {
        return { outcome: 'NOT_FOUND' };
      }
      return { outcome: 'UPDATED', record: updated };
    }

    const current = await this.prisma.client.framework.findUnique({
      where: { id },
      select: { version: true },
    });
    if (!current) {
      return { outcome: 'NOT_FOUND' };
    }
    return { outcome: 'VERSION_CONFLICT', currentVersion: current.version };
  }
}

function toFrameworkRecord(row: {
  id: string;
  code: string;
  name: string;
  description: string;
  origin: FrameworkRecord['origin'];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): FrameworkRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    origin: row.origin,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
