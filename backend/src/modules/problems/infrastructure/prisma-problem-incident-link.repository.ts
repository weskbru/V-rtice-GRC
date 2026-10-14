import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ProblemIncidentLinkRepositoryPort } from '../domain/ports/problem-incident-link-repository.port';

import type { ProblemIncidentLinkRecord } from '../domain/problem-incident-link.entity';
import type { Prisma } from '@prisma/client';

const PROBLEM_INCIDENT_LINK_INCLUDE = {
  incident: { select: { id: true, code: true, title: true, status: true } },
  linkedByUser: { select: { id: true, fullName: true } },
  unlinkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.ProblemIncidentLinkInclude;

type ProblemIncidentLinkWithRelations = Prisma.ProblemIncidentLinkGetPayload<{
  include: typeof PROBLEM_INCIDENT_LINK_INCLUDE;
}>;

function toRecord(row: ProblemIncidentLinkWithRelations): ProblemIncidentLinkRecord {
  return {
    id: row.id,
    problemId: row.problemId,
    incident: {
      id: row.incident.id,
      code: row.incident.code,
      title: row.incident.title,
      status: row.incident.status,
    },
    linkedBy: { id: row.linkedByUser.id, fullName: row.linkedByUser.fullName },
    linkedAt: row.linkedAt,
    unlinkedBy: row.unlinkedByUser
      ? { id: row.unlinkedByUser.id, fullName: row.unlinkedByUser.fullName }
      : undefined,
    unlinkedAt: row.unlinkedAt ?? undefined,
  };
}

@Injectable()
export class PrismaProblemIncidentLinkRepository implements ProblemIncidentLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(
    problemId: string,
    incidentId: string,
  ): Promise<ProblemIncidentLinkRecord | undefined> {
    const row = await this.prisma.client.problemIncidentLink.findFirst({
      where: { problemId, incidentId, unlinkedAt: null },
      include: PROBLEM_INCIDENT_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    problemId: string,
    incidentId: string,
    linkedByUserId: string,
  ): Promise<ProblemIncidentLinkRecord> {
    const created = await this.prisma.client.problemIncidentLink.create({
      data: { problemId, incidentId, linkedByUserId, linkedAt: new Date() },
      include: PROBLEM_INCIDENT_LINK_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(
    problemId: string,
    linkId: string,
  ): Promise<ProblemIncidentLinkRecord | undefined> {
    const row = await this.prisma.client.problemIncidentLink.findFirst({
      where: { id: linkId, problemId },
      include: PROBLEM_INCIDENT_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<ProblemIncidentLinkRecord> {
    const updated = await this.prisma.client.problemIncidentLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
      include: PROBLEM_INCIDENT_LINK_INCLUDE,
    });
    return toRecord(updated);
  }

  async listByProblem(
    problemId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemIncidentLinkRecord[]> {
    const rows = await this.prisma.client.problemIncidentLink.findMany({
      where: includeWithdrawn ? { problemId } : { problemId, unlinkedAt: null },
      include: PROBLEM_INCIDENT_LINK_INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
