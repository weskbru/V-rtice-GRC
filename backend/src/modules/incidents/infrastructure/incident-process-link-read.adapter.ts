import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IncidentProcessLinkReadPort } from '../../../shared/grc-ports/incident-process-link-read.port';

import type { IncidentProcessLinkReadRecord } from '../../../shared/grc-ports/incident-process-link-read.port';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  incident: { select: { id: true, code: true, title: true, status: true } },
  linkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.IncidentProcessLinkInclude;

type LinkWithRelations = Prisma.IncidentProcessLinkGetPayload<{ include: typeof INCLUDE }>;

function toRecord(row: LinkWithRelations): IncidentProcessLinkReadRecord {
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
export class PrismaIncidentProcessLinkReadAdapter implements IncidentProcessLinkReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByProcess(
    processId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProcessLinkReadRecord[]> {
    const rows = await this.prisma.client.incidentProcessLink.findMany({
      where: includeWithdrawn ? { processId } : { processId, unlinkedAt: null },
      include: INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
