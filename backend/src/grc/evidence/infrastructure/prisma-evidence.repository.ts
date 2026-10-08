import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import { EvidenceScopedRepository } from './evidence-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  CreateEvidenceRecordInput,
  EvidenceListFilter,
  EvidencePageResult,
  EvidenceRecord,
  EvidenceRepositoryPort,
  UpdateEvidenceChanges,
} from '../domain/ports/evidence-repository.port';
import type { Prisma } from '@prisma/client';

const EVIDENCE_INCLUDE = {
  orgUnit: { select: { id: true, name: true } },
  ownerUser: { select: { id: true, fullName: true } },
} satisfies Prisma.EvidenceInclude;

type EvidenceWithRelations = Prisma.EvidenceGetPayload<{ include: typeof EVIDENCE_INCLUDE }>;

function toEvidenceRecord(row: EvidenceWithRelations): EvidenceRecord {
  return {
    id: row.id,
    code: row.code,
    orgUnit: { id: row.orgUnit.id, name: row.orgUnit.name },
    title: row.title,
    description: row.description ?? undefined,
    type: row.type,
    source: row.source,
    owner: { id: row.ownerUser.id, fullName: row.ownerUser.fullName },
    collectedOn: row.collectedOn,
    validUntil: row.validUntil ?? undefined,
    status: row.status,
    externalUrl: row.externalUrl ?? undefined,
    observation: row.observation ?? undefined,
    archivedAt: row.archivedAt ?? undefined,
    archivedByUserId: row.archivedByUserId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaEvidenceRepository
  extends EvidenceScopedRepository
  implements EvidenceRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateEvidenceRecordInput): Promise<EvidenceRecord> {
    const created = await this.prisma.client.evidence.create({
      data: {
        code: input.code,
        orgUnitId: input.orgUnitId,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        source: input.source,
        ownerUserId: input.ownerUserId,
        collectedOn: input.collectedOn,
        validUntil: input.validUntil ?? null,
        externalUrl: input.externalUrl ?? null,
        observation: input.observation ?? null,
      },
      include: EVIDENCE_INCLUDE,
    });
    return toEvidenceRecord(created);
  }

  async findById(scope: ScopeFilter, id: string): Promise<EvidenceRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.evidence.findFirst({ where, include: EVIDENCE_INCLUDE }),
    );
    return row ? toEvidenceRecord(row) : undefined;
  }

  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.evidence.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }

  async update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateEvidenceChanges,
  ): Promise<EvidenceRecord | undefined> {
    const data: Prisma.EvidenceUpdateInput = {};
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.type !== undefined) data.type = changes.type;
    if (changes.source !== undefined) data.source = changes.source;
    if (changes.ownerUserId !== undefined) {
      data.ownerUser = { connect: { id: changes.ownerUserId } };
    }
    if (changes.collectedOn !== undefined) data.collectedOn = changes.collectedOn;
    if (changes.validUntil !== undefined) data.validUntil = changes.validUntil;
    if (changes.externalUrl !== undefined) data.externalUrl = changes.externalUrl;
    if (changes.observation !== undefined) data.observation = changes.observation;

    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.evidence.updateMany({ where, data }),
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
  ): Promise<EvidenceRecord | undefined> {
    const result = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.evidence.updateMany({
        where,
        data: { status: 'ARCHIVED', archivedAt, archivedByUserId },
      }),
    );
    if (result.count === 0) {
      return undefined;
    }
    return this.findById(scope, id);
  }

  async list(
    scope: ScopeFilter,
    filter: EvidenceListFilter,
    page: number,
    pageSize: number,
  ): Promise<EvidencePageResult> {
    const where: Prisma.EvidenceWhereInput = {};
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.type !== undefined) where.type = filter.type;
    if (filter.ownerUserId !== undefined) where.ownerUserId = filter.ownerUserId;
    if (filter.orgUnitId !== undefined) where.orgUnitId = filter.orgUnitId;
    if (filter.expiringBefore !== undefined) {
      where.validUntil = { lt: filter.expiringBefore };
    }
    if (filter.search !== undefined && filter.search.length > 0) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { code: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.subjectType !== undefined && filter.subjectId !== undefined) {
      where.links = {
        some: {
          subjectType: filter.subjectType,
          subjectId: filter.subjectId,
          unlinkedAt: null,
        },
      };
    }

    const scopedWhere = this.applyScope(scope, where);

    const [rows, total] = await Promise.all([
      this.prisma.client.evidence.findMany({
        where: scopedWhere,
        include: EVIDENCE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.evidence.count({ where: scopedWhere }),
    ]);

    return {
      items: rows.map(toEvidenceRecord),
      page,
      pageSize,
      total,
    };
  }
}
