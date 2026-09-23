import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  FrameworkVersionRepositoryPort,
  type CreateFrameworkVersionInput,
  type FrameworkVersionListPage,
  type FrameworkVersionListQuery,
  type FrameworkVersionRecord,
  type FrameworkVersionUpdateResult,
  type PublishFrameworkVersionChanges,
  type UpdateFrameworkVersionChanges,
} from '../domain/ports/framework-version-repository.port';

import type { Prisma } from '@prisma/client';

const FRAMEWORK_VERSION_INCLUDE = {
  framework: { select: { id: true, code: true, name: true } },
  publishedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.FrameworkVersionInclude;

type FrameworkVersionWithRelations = Prisma.FrameworkVersionGetPayload<{
  include: typeof FRAMEWORK_VERSION_INCLUDE;
}>;

@Injectable()
export class FrameworkVersionRepository implements FrameworkVersionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateFrameworkVersionInput): Promise<FrameworkVersionRecord> {
    const created = await this.prisma.client.frameworkVersion.create({
      data: { frameworkId: input.frameworkId, label: input.label },
      include: FRAMEWORK_VERSION_INCLUDE,
    });
    return toFrameworkVersionRecord(created);
  }

  async findById(id: string): Promise<FrameworkVersionRecord | undefined> {
    const row = await this.prisma.client.frameworkVersion.findUnique({
      where: { id },
      include: FRAMEWORK_VERSION_INCLUDE,
    });
    return row ? toFrameworkVersionRecord(row) : undefined;
  }

  async findByFrameworkAndLabel(
    frameworkId: string,
    label: string,
    excludeVersionId?: string,
  ): Promise<{ readonly id: string } | undefined> {
    const row = await this.prisma.client.frameworkVersion.findFirst({
      where: {
        frameworkId,
        label,
        ...(excludeVersionId ? { id: { not: excludeVersionId } } : {}),
      },
      select: { id: true },
    });
    return row ?? undefined;
  }

  async list(query: FrameworkVersionListQuery): Promise<FrameworkVersionListPage> {
    const where: Prisma.FrameworkVersionWhereInput = { frameworkId: query.frameworkId };
    if (query.status && query.status.length > 0) {
      where.status = { in: Array.from(query.status) };
    }

    const [rows, total] = await Promise.all([
      this.prisma.client.frameworkVersion.findMany({
        where,
        include: FRAMEWORK_VERSION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.frameworkVersion.count({ where }),
    ]);

    return { items: rows.map(toFrameworkVersionRecord), total };
  }

  async countRequirements(versionId: string): Promise<number> {
    return this.prisma.client.requirement.count({ where: { frameworkVersionId: versionId } });
  }

  async updateLabelWithVersion(
    id: string,
    expectedVersion: number,
    changes: UpdateFrameworkVersionChanges,
  ): Promise<FrameworkVersionUpdateResult> {
    const data: Prisma.FrameworkVersionUncheckedUpdateManyInput = { version: { increment: 1 } };
    if (changes.label !== undefined) data.label = changes.label;
    return this.conditionalVersionUpdate(id, expectedVersion, data);
  }

  async publishWithVersion(
    id: string,
    expectedVersion: number,
    changes: PublishFrameworkVersionChanges,
  ): Promise<FrameworkVersionUpdateResult> {
    const data: Prisma.FrameworkVersionUncheckedUpdateManyInput = {
      version: { increment: 1 },
      status: 'PUBLISHED',
      publishedAt: changes.publishedAt,
      publishedByUserId: changes.publishedByUserId,
    };
    return this.conditionalVersionUpdate(id, expectedVersion, data);
  }

  private async conditionalVersionUpdate(
    id: string,
    expectedVersion: number,
    data: Prisma.FrameworkVersionUncheckedUpdateManyInput,
  ): Promise<FrameworkVersionUpdateResult> {
    const result = await this.prisma.client.frameworkVersion.updateMany({
      where: { id, version: expectedVersion },
      data,
    });

    if (result.count > 0) {
      const updated = await this.findById(id);
      if (!updated) {
        return { outcome: 'NOT_FOUND' };
      }
      return { outcome: 'UPDATED', record: updated };
    }

    const current = await this.prisma.client.frameworkVersion.findUnique({
      where: { id },
      select: { version: true, status: true },
    });
    if (!current) {
      return { outcome: 'NOT_FOUND' };
    }
    return {
      outcome: 'VERSION_CONFLICT',
      currentVersion: current.version,
      currentStatus: current.status,
    };
  }
}

function toFrameworkVersionRecord(row: FrameworkVersionWithRelations): FrameworkVersionRecord {
  return {
    id: row.id,
    framework: row.framework,
    label: row.label,
    status: row.status,
    publishedAt: row.publishedAt ?? undefined,
    publishedBy: row.publishedByUser ?? undefined,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
