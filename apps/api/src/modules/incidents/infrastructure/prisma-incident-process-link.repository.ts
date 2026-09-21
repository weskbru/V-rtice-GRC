/**
 * 008-incidents-problems, US3 — the sole implementation of
 * `IncidentProcessLinkRepositoryPort`. Mirrors
 * `prisma-incident-risk-link.repository.ts` exactly, against `Process`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IncidentProcessLinkRepositoryPort } from '../domain/ports/incident-process-link-repository.port';

import type { IncidentProcessLinkRecord } from '../domain/incident-process-link.entity';
import type { Prisma } from '@prisma/client';

const INCIDENT_PROCESS_LINK_INCLUDE = {
  process: { select: { id: true, code: true, name: true } },
  linkedByUser: { select: { id: true, fullName: true } },
  unlinkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.IncidentProcessLinkInclude;

type IncidentProcessLinkWithRelations = Prisma.IncidentProcessLinkGetPayload<{
  include: typeof INCIDENT_PROCESS_LINK_INCLUDE;
}>;

function toRecord(row: IncidentProcessLinkWithRelations): IncidentProcessLinkRecord {
  return {
    id: row.id,
    incidentId: row.incidentId,
    process: { id: row.process.id, code: row.process.code, name: row.process.name },
    linkedBy: { id: row.linkedByUser.id, fullName: row.linkedByUser.fullName },
    linkedAt: row.linkedAt,
    unlinkedBy: row.unlinkedByUser
      ? { id: row.unlinkedByUser.id, fullName: row.unlinkedByUser.fullName }
      : undefined,
    unlinkedAt: row.unlinkedAt ?? undefined,
  };
}

@Injectable()
export class PrismaIncidentProcessLinkRepository implements IncidentProcessLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(
    incidentId: string,
    processId: string,
  ): Promise<IncidentProcessLinkRecord | undefined> {
    const row = await this.prisma.client.incidentProcessLink.findFirst({
      where: { incidentId, processId, unlinkedAt: null },
      include: INCIDENT_PROCESS_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    incidentId: string,
    processId: string,
    linkedByUserId: string,
  ): Promise<IncidentProcessLinkRecord> {
    const created = await this.prisma.client.incidentProcessLink.create({
      data: { incidentId, processId, linkedByUserId, linkedAt: new Date() },
      include: INCIDENT_PROCESS_LINK_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(
    incidentId: string,
    linkId: string,
  ): Promise<IncidentProcessLinkRecord | undefined> {
    const row = await this.prisma.client.incidentProcessLink.findFirst({
      where: { id: linkId, incidentId },
      include: INCIDENT_PROCESS_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<IncidentProcessLinkRecord> {
    const updated = await this.prisma.client.incidentProcessLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
      include: INCIDENT_PROCESS_LINK_INCLUDE,
    });
    return toRecord(updated);
  }

  async listByIncident(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProcessLinkRecord[]> {
    const rows = await this.prisma.client.incidentProcessLink.findMany({
      where: includeWithdrawn ? { incidentId } : { incidentId, unlinkedAt: null },
      include: INCIDENT_PROCESS_LINK_INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
