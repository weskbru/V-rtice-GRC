import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import { AssetScopedRepository } from './asset-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  AssetListFilter,
  AssetListResult,
  AssetListSort,
  AssetRecord,
  AssetRepositoryPort,
  AssetSummaryRecord,
  CreateAssetRecordInput,
  UpdateAssetChanges,
} from '../domain/ports/asset-repository.port';
import type { Prisma } from '@prisma/client';

const DESCRIPTION_EXCERPT_LENGTH = 200;

const ASSET_INCLUDE = {
  orgUnit: { select: { id: true, code: true, name: true } },
} satisfies Prisma.AssetInclude;

type AssetWithRelations = Prisma.AssetGetPayload<{ include: typeof ASSET_INCLUDE }>;

@Injectable()
export class PrismaAssetRepository extends AssetScopedRepository implements AssetRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateAssetRecordInput): Promise<AssetRecord> {
    const created = await this.prisma.client.asset.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        orgUnitId: input.orgUnitId,
      },
      include: ASSET_INCLUDE,
    });
    return this.toAssetRecord(created, [], []);
  }

  async findById(scope: ScopeFilter, id: string): Promise<AssetRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.asset.findFirst({ where, include: ASSET_INCLUDE }),
    );
    if (!row) {
      return undefined;
    }

    const [riskLinks, controlLinks] = await Promise.all([
      this.prisma.client.riskAssetLink.findMany({
        where: { assetId: row.id, unlinkedAt: null },
        select: { risk: { select: { id: true, code: true, title: true } } },
      }),
      this.prisma.client.controlAssetLink.findMany({
        where: { assetId: row.id, unlinkedAt: null },
        select: { control: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    return this.toAssetRecord(
      row,
      riskLinks.map((link) => link.risk),
      controlLinks.map((link) => link.control),
    );
  }

  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.asset.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }

  async update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateAssetChanges,
  ): Promise<AssetRecord | undefined> {
    const data: Prisma.AssetUncheckedUpdateManyInput = {};
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.orgUnitId !== undefined) data.orgUnitId = changes.orgUnitId;

    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.asset.updateMany({ where, data }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async deactivate(scope: ScopeFilter, id: string): Promise<AssetRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.asset.updateMany({ where, data: { isActive: false } }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async reactivate(scope: ScopeFilter, id: string): Promise<AssetRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.asset.updateMany({ where, data: { isActive: true } }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async list(
    scope: ScopeFilter,
    filter: AssetListFilter,
    sort: AssetListSort,
    page: number,
    pageSize: number,
  ): Promise<AssetListResult> {
    const where: Prisma.AssetWhereInput = {};
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

    const orderBy: Prisma.AssetOrderByWithRelationInput[] = [
      { [sort.field]: sort.direction },
      { code: 'asc' },
    ];

    const [rows, total] = await Promise.all([
      this.prisma.client.asset.findMany({
        where: scopedWhere,
        include: ASSET_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.asset.count({ where: scopedWhere }),
    ]);

    return { items: rows.map((row) => this.toSummaryRecord(row)), total };
  }

  private combineOrgUnitScope(
    scope: ScopeFilter,
    where: Prisma.AssetWhereInput,
    requestedOrgUnitId: readonly string[] | undefined,
  ): Prisma.AssetWhereInput {
    if (scope.kind === 'GLOBAL') {
      return where;
    }
    if (requestedOrgUnitId && requestedOrgUnitId.length > 0) {
      const intersection = requestedOrgUnitId.filter((id) => scope.unitIds.has(id));
      return { ...where, orgUnitId: { in: intersection } };
    }
    return this.applyScope(scope, where);
  }

  private toSummaryRecord(row: AssetWithRelations): AssetSummaryRecord {
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

  private toAssetRecord(
    row: AssetWithRelations,
    risks: readonly { readonly id: string; readonly code: string; readonly title: string }[],
    controls: readonly { readonly id: string; readonly code: string; readonly name: string }[],
  ): AssetRecord {
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
