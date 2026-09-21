/**
 * The sole implementation of `IncidentAssetLinkReadPort`
 * (`shared/grc-ports/incident-asset-link-read.port.ts`, ADR-020 part 3).
 * Mirrors `incident-risk-link-read.adapter.ts` exactly, against `Asset`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IncidentAssetLinkReadPort } from '../../../shared/grc-ports/incident-asset-link-read.port';

import type { IncidentAssetLinkReadRecord } from '../../../shared/grc-ports/incident-asset-link-read.port';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  incident: { select: { id: true, code: true, title: true, status: true } },
  linkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.IncidentAssetLinkInclude;

type LinkWithRelations = Prisma.IncidentAssetLinkGetPayload<{ include: typeof INCLUDE }>;

function toRecord(row: LinkWithRelations): IncidentAssetLinkReadRecord {
  return {
    id: row.id,
    incident: {
      id: row.incident.id,
      code: row.incident.code,
      title: row.incident.title,
      status: row.incident.status,
    },
    linkedBy: { id: row.linkedByUser.id, fullName: row.linkedByUser.fullName },
    linkedAt: row.linkedAt,
    unlinkedAt: row.unlinkedAt ?? undefined,
  };
}

@Injectable()
export class PrismaIncidentAssetLinkReadAdapter implements IncidentAssetLinkReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByAsset(
    assetId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentAssetLinkReadRecord[]> {
    const rows = await this.prisma.client.incidentAssetLink.findMany({
      where: includeWithdrawn ? { assetId } : { assetId, unlinkedAt: null },
      include: INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
