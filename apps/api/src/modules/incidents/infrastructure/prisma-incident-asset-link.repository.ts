/**
 * 008-incidents-problems, US3 — the sole implementation of
 * `IncidentAssetLinkRepositoryPort`. Mirrors
 * `prisma-incident-risk-link.repository.ts` exactly, against `Asset`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IncidentAssetLinkRepositoryPort } from '../domain/ports/incident-asset-link-repository.port';

import type { IncidentAssetLinkRecord } from '../domain/incident-asset-link.entity';
import type { Prisma } from '@prisma/client';

const INCIDENT_ASSET_LINK_INCLUDE = {
  asset: { select: { id: true, code: true, name: true } },
  linkedByUser: { select: { id: true, fullName: true } },
  unlinkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.IncidentAssetLinkInclude;

type IncidentAssetLinkWithRelations = Prisma.IncidentAssetLinkGetPayload<{
  include: typeof INCIDENT_ASSET_LINK_INCLUDE;
}>;

function toRecord(row: IncidentAssetLinkWithRelations): IncidentAssetLinkRecord {
  return {
    id: row.id,
    incidentId: row.incidentId,
    asset: { id: row.asset.id, code: row.asset.code, name: row.asset.name },
    linkedBy: { id: row.linkedByUser.id, fullName: row.linkedByUser.fullName },
    linkedAt: row.linkedAt,
    unlinkedBy: row.unlinkedByUser
      ? { id: row.unlinkedByUser.id, fullName: row.unlinkedByUser.fullName }
      : undefined,
    unlinkedAt: row.unlinkedAt ?? undefined,
  };
}

@Injectable()
export class PrismaIncidentAssetLinkRepository implements IncidentAssetLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(
    incidentId: string,
    assetId: string,
  ): Promise<IncidentAssetLinkRecord | undefined> {
    const row = await this.prisma.client.incidentAssetLink.findFirst({
      where: { incidentId, assetId, unlinkedAt: null },
      include: INCIDENT_ASSET_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    incidentId: string,
    assetId: string,
    linkedByUserId: string,
  ): Promise<IncidentAssetLinkRecord> {
    const created = await this.prisma.client.incidentAssetLink.create({
      data: { incidentId, assetId, linkedByUserId, linkedAt: new Date() },
      include: INCIDENT_ASSET_LINK_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(incidentId: string, linkId: string): Promise<IncidentAssetLinkRecord | undefined> {
    const row = await this.prisma.client.incidentAssetLink.findFirst({
      where: { id: linkId, incidentId },
      include: INCIDENT_ASSET_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<IncidentAssetLinkRecord> {
    const updated = await this.prisma.client.incidentAssetLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
      include: INCIDENT_ASSET_LINK_INCLUDE,
    });
    return toRecord(updated);
  }

  async listByIncident(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentAssetLinkRecord[]> {
    const rows = await this.prisma.client.incidentAssetLink.findMany({
      where: includeWithdrawn ? { incidentId } : { incidentId, unlinkedAt: null },
      include: INCIDENT_ASSET_LINK_INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
