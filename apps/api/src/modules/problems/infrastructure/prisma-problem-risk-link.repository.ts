/**
 * 008-incidents-problems, US3 — the sole implementation of
 * `ProblemRiskLinkRepositoryPort`. Mirrors
 * `modules/incidents/infrastructure/prisma-incident-risk-link.repository.ts`
 * exactly.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ProblemRiskLinkRepositoryPort } from '../domain/ports/problem-risk-link-repository.port';

import type { ProblemRiskLinkRecord } from '../domain/problem-risk-link.entity';
import type { Prisma } from '@prisma/client';

const PROBLEM_RISK_LINK_INCLUDE = {
  risk: { select: { id: true, code: true, title: true } },
  linkedByUser: { select: { id: true, fullName: true } },
  unlinkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.ProblemRiskLinkInclude;

type ProblemRiskLinkWithRelations = Prisma.ProblemRiskLinkGetPayload<{
  include: typeof PROBLEM_RISK_LINK_INCLUDE;
}>;

function toRecord(row: ProblemRiskLinkWithRelations): ProblemRiskLinkRecord {
  return {
    id: row.id,
    problemId: row.problemId,
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
export class PrismaProblemRiskLinkRepository implements ProblemRiskLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(
    problemId: string,
    riskId: string,
  ): Promise<ProblemRiskLinkRecord | undefined> {
    const row = await this.prisma.client.problemRiskLink.findFirst({
      where: { problemId, riskId, unlinkedAt: null },
      include: PROBLEM_RISK_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    problemId: string,
    riskId: string,
    linkedByUserId: string,
  ): Promise<ProblemRiskLinkRecord> {
    const created = await this.prisma.client.problemRiskLink.create({
      data: { problemId, riskId, linkedByUserId, linkedAt: new Date() },
      include: PROBLEM_RISK_LINK_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(problemId: string, linkId: string): Promise<ProblemRiskLinkRecord | undefined> {
    const row = await this.prisma.client.problemRiskLink.findFirst({
      where: { id: linkId, problemId },
      include: PROBLEM_RISK_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<ProblemRiskLinkRecord> {
    const updated = await this.prisma.client.problemRiskLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
      include: PROBLEM_RISK_LINK_INCLUDE,
    });
    return toRecord(updated);
  }

  async listByProblem(
    problemId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemRiskLinkRecord[]> {
    const rows = await this.prisma.client.problemRiskLink.findMany({
      where: includeWithdrawn ? { problemId } : { problemId, unlinkedAt: null },
      include: PROBLEM_RISK_LINK_INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
