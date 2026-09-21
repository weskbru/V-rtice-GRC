/**
 * T037/003-controls-management, User Story 3 — the sole implementation of
 * `ControlAssetLinkRepositoryPort`. Same shape and rationale as
 * `control-process-link.repository.ts` above, against `Asset` instead of
 * `Process`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ControlAssetLinkRepositoryPort } from '../domain/ports/control-relationship-repository.port';

import type { ControlEntityLinkRecord } from '../domain/ports/control-relationship-repository.port';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  asset: { select: { id: true, code: true, name: true } },
  linkedByUser: { select: { id: true, fullName: true, email: true } },
  unlinkedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ControlAssetLinkInclude;

type LinkWithRelations = Prisma.ControlAssetLinkGetPayload<{ include: typeof INCLUDE }>;

function toRecord(row: LinkWithRelations): ControlEntityLinkRecord {
  return {
    id: row.id,
    controlId: row.controlId,
    entity: { id: row.asset.id, code: row.asset.code, name: row.asset.name },
    linkedBy: {
      id: row.linkedByUser.id,
      fullName: row.linkedByUser.fullName,
      email: row.linkedByUser.email,
    },
    linkedAt: row.linkedAt,
    unlinkedBy: row.unlinkedByUser
      ? {
          id: row.unlinkedByUser.id,
          fullName: row.unlinkedByUser.fullName,
          email: row.unlinkedByUser.email,
        }
      : undefined,
    unlinkedAt: row.unlinkedAt ?? undefined,
  };
}

@Injectable()
export class ControlAssetLinkRepository implements ControlAssetLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(
    controlId: string,
    assetId: string,
  ): Promise<ControlEntityLinkRecord | undefined> {
    const row = await this.prisma.client.controlAssetLink.findFirst({
      where: { controlId, assetId, unlinkedAt: null },
      include: INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    controlId: string,
    assetId: string,
    linkedByUserId: string,
  ): Promise<ControlEntityLinkRecord> {
    const created = await this.prisma.client.controlAssetLink.create({
      data: { controlId, assetId, linkedByUserId, linkedAt: new Date() },
      include: INCLUDE,
    });
    return toRecord(created);
  }

  async findById(controlId: string, linkId: string): Promise<ControlEntityLinkRecord | undefined> {
    const row = await this.prisma.client.controlAssetLink.findFirst({
      where: { id: linkId, controlId },
      include: INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void> {
    await this.prisma.client.controlAssetLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
    });
  }

  async listByControl(
    controlId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ControlEntityLinkRecord[]> {
    const rows = await this.prisma.client.controlAssetLink.findMany({
      where: includeWithdrawn ? { controlId } : { controlId, unlinkedAt: null },
      include: INCLUDE,
      orderBy: [{ linkedAt: 'desc' }],
    });
    return rows.map(toRecord);
  }
}
