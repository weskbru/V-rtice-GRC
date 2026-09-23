import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RequirementControlLinkRepositoryPort } from '../domain/ports/requirement-control-link-repository.port';

import type { RequirementControlLinkRecord } from '../domain/requirement-control-link.entity';
import type { Prisma } from '@prisma/client';

const LINK_INCLUDE = {
  control: { select: { id: true, code: true, name: true } },
  linkedByUser: { select: { id: true, fullName: true, email: true } },
  unlinkedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RequirementControlLinkInclude;

type LinkWithRelations = Prisma.RequirementControlLinkGetPayload<{ include: typeof LINK_INCLUDE }>;

@Injectable()
export class RequirementControlLinkRepository implements RequirementControlLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(
    requirementId: string,
    controlId: string,
  ): Promise<RequirementControlLinkRecord | undefined> {
    const row = await this.prisma.client.requirementControlLink.findFirst({
      where: { requirementId, controlId, unlinkedAt: null },
      include: LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    requirementId: string,
    controlId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<RequirementControlLinkRecord> {
    const created = await this.prisma.client.requirementControlLink.create({
      data: { requirementId, controlId, linkedByUserId, linkedAt },
      include: LINK_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(
    requirementId: string,
    linkId: string,
  ): Promise<RequirementControlLinkRecord | undefined> {
    const row = await this.prisma.client.requirementControlLink.findFirst({
      where: { id: linkId, requirementId },
      include: LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<RequirementControlLinkRecord> {
    const updated = await this.prisma.client.requirementControlLink.update({
      where: { id: linkId },
      data: { unlinkedByUserId, unlinkedAt },
      include: LINK_INCLUDE,
    });
    return toRecord(updated);
  }

  async list(
    requirementId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly RequirementControlLinkRecord[]> {
    const where: Prisma.RequirementControlLinkWhereInput = includeWithdrawn
      ? { requirementId }
      : { requirementId, unlinkedAt: null };
    const rows = await this.prisma.client.requirementControlLink.findMany({
      where,
      include: LINK_INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async findActiveControlIdsByRequirement(
    requirementIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    if (requirementIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.client.requirementControlLink.findMany({
      where: { requirementId: { in: Array.from(requirementIds) }, unlinkedAt: null },
      select: { requirementId: true, controlId: true },
    });
    const byRequirement = new Map<string, string[]>();
    for (const row of rows) {
      const existing = byRequirement.get(row.requirementId);
      if (existing) {
        existing.push(row.controlId);
      } else {
        byRequirement.set(row.requirementId, [row.controlId]);
      }
    }
    return byRequirement;
  }
}

function toRecord(row: LinkWithRelations): RequirementControlLinkRecord {
  return {
    id: row.id,
    requirementId: row.requirementId,
    control: row.control,
    linkedBy: row.linkedByUser,
    linkedAt: row.linkedAt,
    unlinkedBy: row.unlinkedByUser ?? undefined,
    unlinkedAt: row.unlinkedAt ?? undefined,
  };
}
