/**
 * 008-incidents-problems, US3 — the sole implementation of
 * `IncidentRiskLinkRepositoryPort`. Mirrors
 * `grc/finding/infrastructure/prisma-finding-risk-link.repository.ts`
 * exactly.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IncidentRiskLinkRepositoryPort } from '../domain/ports/incident-risk-link-repository.port';

import type { IncidentRiskLinkRecord } from '../domain/incident-risk-link.entity';
import type { Prisma } from '@prisma/client';

const INCIDENT_RISK_LINK_INCLUDE = {
  risk: { select: { id: true, code: true, title: true } },
  linkedByUser: { select: { id: true, fullName: true } },
  unlinkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.IncidentRiskLinkInclude;

type IncidentRiskLinkWithRelations = Prisma.IncidentRiskLinkGetPayload<{
  include: typeof INCIDENT_RISK_LINK_INCLUDE;
}>;

function toRecord(row: IncidentRiskLinkWithRelations): IncidentRiskLinkRecord {
  return {
    id: row.id,
    incidentId: row.incidentId,
    risk: { id: row.risk.id, code: row.risk.code, title: row.risk.title },
    linkedBy: { id: row.linkedByUser.id, fullName: row.linkedByUser.fullName },
    linkedAt: row.linkedAt,
    unlinkedBy: row.unlinkedByUser
      ? { id: row.unlinkedByUser.id, fullName: row.unlinkedByUser.fullName }
      : undefined,
    unlinkedAt: row.unlinkedAt ?? undefined,
  };
}

@Injectable()
export class PrismaIncidentRiskLinkRepository implements IncidentRiskLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(
    incidentId: string,
    riskId: string,
  ): Promise<IncidentRiskLinkRecord | undefined> {
    const row = await this.prisma.client.incidentRiskLink.findFirst({
      where: { incidentId, riskId, unlinkedAt: null },
      include: INCIDENT_RISK_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    incidentId: string,
    riskId: string,
    linkedByUserId: string,
  ): Promise<IncidentRiskLinkRecord> {
    const created = await this.prisma.client.incidentRiskLink.create({
      data: { incidentId, riskId, linkedByUserId, linkedAt: new Date() },
      include: INCIDENT_RISK_LINK_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(incidentId: string, linkId: string): Promise<IncidentRiskLinkRecord | undefined> {
    const row = await this.prisma.client.incidentRiskLink.findFirst({
      where: { id: linkId, incidentId },
      include: INCIDENT_RISK_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<IncidentRiskLinkRecord> {
    const updated = await this.prisma.client.incidentRiskLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
      include: INCIDENT_RISK_LINK_INCLUDE,
    });
    return toRecord(updated);
  }

  async listByIncident(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentRiskLinkRecord[]> {
    const rows = await this.prisma.client.incidentRiskLink.findMany({
      where: includeWithdrawn ? { incidentId } : { incidentId, unlinkedAt: null },
      include: INCIDENT_RISK_LINK_INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
