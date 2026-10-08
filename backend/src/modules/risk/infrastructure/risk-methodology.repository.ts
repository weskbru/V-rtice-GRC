import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RiskMethodologyRepositoryPort } from '../domain/ports/risk-methodology-repository.port';

import type { MethodologyConfiguration } from '../domain/methodology.schema';
import type {
  CreateMethodologyVersionRecordInput,
  MethodologyVersionPage,
  MethodologyVersionRecord,
} from '../domain/ports/risk-methodology-repository.port';
import type { Prisma } from '@prisma/client';

const VERSION_INCLUDE = {
  methodology: { select: { name: true } },
  createdByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RiskMethodologyVersionInclude;

type VersionWithRelations = Prisma.RiskMethodologyVersionGetPayload<{
  include: typeof VERSION_INCLUDE;
}>;

@Injectable()
export class RiskMethodologyRepository implements RiskMethodologyRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveMethodologyId(): Promise<string | undefined> {
    const methodology = await this.prisma.client.riskMethodology.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    return methodology?.id;
  }

  async findActiveVersion(): Promise<MethodologyVersionRecord | undefined> {
    const methodologyId = await this.findActiveMethodologyId();
    if (!methodologyId) {
      return undefined;
    }

    const row = await this.prisma.client.riskMethodologyVersion.findFirst({
      where: { methodologyId, effectiveFrom: { lte: new Date() } },
      orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
      include: VERSION_INCLUDE,
    });

    return row ? toMethodologyVersionRecord(row) : undefined;
  }

  async findVersionById(id: string): Promise<MethodologyVersionRecord | undefined> {
    const row = await this.prisma.client.riskMethodologyVersion.findUnique({
      where: { id },
      include: VERSION_INCLUDE,
    });
    return row ? toMethodologyVersionRecord(row) : undefined;
  }

  async listVersions(page: number, pageSize: number): Promise<MethodologyVersionPage> {
    const methodologyId = await this.findActiveMethodologyId();
    if (!methodologyId) {
      return { items: [], total: 0 };
    }

    const where: Prisma.RiskMethodologyVersionWhereInput = { methodologyId };

    const [rows, total] = await Promise.all([
      this.prisma.client.riskMethodologyVersion.findMany({
        where,
        orderBy: { versionNumber: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: VERSION_INCLUDE,
      }),
      this.prisma.client.riskMethodologyVersion.count({ where }),
    ]);

    return { items: rows.map(toMethodologyVersionRecord), total };
  }

  async createVersion(
    input: CreateMethodologyVersionRecordInput,
  ): Promise<MethodologyVersionRecord> {
    const latest = await this.prisma.client.riskMethodologyVersion.findFirst({
      where: { methodologyId: input.methodologyId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

    const created = await this.prisma.client.riskMethodologyVersion.create({
      data: {
        methodologyId: input.methodologyId,
        versionNumber: nextVersionNumber,
        probabilityScale: input.probabilityScale as unknown as Prisma.InputJsonValue,
        impactScale: input.impactScale as unknown as Prisma.InputJsonValue,
        matrix: input.matrix as unknown as Prisma.InputJsonValue,
        levelBands: input.levelBands as unknown as Prisma.InputJsonValue,
        effectiveFrom: input.effectiveFrom,
        createdByUserId: input.createdByUserId,
      },
      include: VERSION_INCLUDE,
    });

    return toMethodologyVersionRecord(created);
  }
}

function toMethodologyVersionRecord(row: VersionWithRelations): MethodologyVersionRecord {
  return {
    id: row.id,
    methodologyId: row.methodologyId,
    methodologyName: row.methodology.name,
    versionNumber: row.versionNumber,
    probabilityScale:
      row.probabilityScale as unknown as MethodologyConfiguration['probabilityScale'],
    impactScale: row.impactScale as unknown as MethodologyConfiguration['impactScale'],
    matrix: row.matrix as unknown as MethodologyConfiguration['matrix'],
    levelBands: row.levelBands as unknown as MethodologyConfiguration['levelBands'],
    effectiveFrom: row.effectiveFrom,
    createdBy: {
      id: row.createdByUser.id,
      fullName: row.createdByUser.fullName,
      email: row.createdByUser.email,
    },
  };
}
