/**
 * The sole implementation of `IncidentRiskLinkReadPort`
 * (`shared/grc-ports/incident-risk-link-read.port.ts`, ADR-020 part 3).
 * `modules/incidents` OWNS `IncidentRiskLink` (and `Incident`), so this
 * adapter is the one place in the platform allowed to query it on behalf
 * of another module — mirrors
 * `modules/risk/infrastructure/risk-control-link-read.adapter.ts` exactly,
 * for the opposite direction.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IncidentRiskLinkReadPort } from '../../../shared/grc-ports/incident-risk-link-read.port';

import type { IncidentRiskLinkReadRecord } from '../../../shared/grc-ports/incident-risk-link-read.port';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  incident: { select: { id: true, code: true, title: true, status: true } },
  linkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.IncidentRiskLinkInclude;

type LinkWithRelations = Prisma.IncidentRiskLinkGetPayload<{ include: typeof INCLUDE }>;

function toRecord(row: LinkWithRelations): IncidentRiskLinkReadRecord {
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
export class PrismaIncidentRiskLinkReadAdapter implements IncidentRiskLinkReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByRisk(
    riskId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentRiskLinkReadRecord[]> {
    const rows = await this.prisma.client.incidentRiskLink.findMany({
      where: includeWithdrawn ? { riskId } : { riskId, unlinkedAt: null },
      include: INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
