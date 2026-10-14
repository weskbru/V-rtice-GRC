import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { FindingControlLinkRepositoryPort } from '../domain/ports/finding-control-link-repository.port';

import type { FindingControlLinkRecord } from '../domain/finding-control-link.entity';
import type { Prisma } from '@prisma/client';

const FINDING_CONTROL_LINK_INCLUDE = {
  control: { select: { id: true, code: true, name: true } },
  linkedByUser: { select: { id: true, fullName: true } },
  unlinkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.FindingControlLinkInclude;

type FindingControlLinkWithRelations = Prisma.FindingControlLinkGetPayload<{
  include: typeof FINDING_CONTROL_LINK_INCLUDE;
}>;

function toRecord(row: FindingControlLinkWithRelations): FindingControlLinkRecord {
  return {
    id: row.id,
    findingId: row.findingId,
    control: { id: row.control.id, code: row.control.code, name: row.control.name },
    linkedBy: { id: row.linkedByUser.id, fullName: row.linkedByUser.fullName },
    linkedAt: row.linkedAt,
    unlinkedBy: row.unlinkedByUser
      ? { id: row.unlinkedByUser.id, fullName: row.unlinkedByUser.fullName }
      : undefined,
    unlinkedAt: row.unlinkedAt ?? undefined,
  };
}

@Injectable()
export class PrismaFindingControlLinkRepository implements FindingControlLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(
    findingId: string,
    controlId: string,
  ): Promise<FindingControlLinkRecord | undefined> {
    const row = await this.prisma.client.findingControlLink.findFirst({
      where: { findingId, controlId, unlinkedAt: null },
      include: FINDING_CONTROL_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    findingId: string,
    controlId: string,
    linkedByUserId: string,
  ): Promise<FindingControlLinkRecord> {
    const created = await this.prisma.client.findingControlLink.create({
      data: { findingId, controlId, linkedByUserId, linkedAt: new Date() },
      include: FINDING_CONTROL_LINK_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(findingId: string, linkId: string): Promise<FindingControlLinkRecord | undefined> {
    const row = await this.prisma.client.findingControlLink.findFirst({
      where: { id: linkId, findingId },
      include: FINDING_CONTROL_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<FindingControlLinkRecord> {
    const updated = await this.prisma.client.findingControlLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
      include: FINDING_CONTROL_LINK_INCLUDE,
    });
    return toRecord(updated);
  }

  async listByFinding(
    findingId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly FindingControlLinkRecord[]> {
    const rows = await this.prisma.client.findingControlLink.findMany({
      where: includeWithdrawn ? { findingId } : { findingId, unlinkedAt: null },
      include: FINDING_CONTROL_LINK_INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
