/**
 * The sole implementation of `ProblemRiskLinkReadPort`
 * (`shared/grc-ports/problem-risk-link-read.port.ts`, ADR-020 part 3).
 * `modules/problems` OWNS `ProblemRiskLink` (and `Problem`), so this
 * adapter is the one place in the platform allowed to query it on behalf
 * of another module — mirrors
 * `modules/incidents/infrastructure/incident-risk-link-read.adapter.ts`
 * exactly, for `Problem` instead of `Incident`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ProblemRiskLinkReadPort } from '../../../shared/grc-ports/problem-risk-link-read.port';

import type { ProblemRiskLinkReadRecord } from '../../../shared/grc-ports/problem-risk-link-read.port';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  problem: { select: { id: true, code: true, title: true, status: true } },
  linkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.ProblemRiskLinkInclude;

type LinkWithRelations = Prisma.ProblemRiskLinkGetPayload<{ include: typeof INCLUDE }>;

function toRecord(row: LinkWithRelations): ProblemRiskLinkReadRecord {
  return {
    id: row.id,
    problem: {
      id: row.problem.id,
      code: row.problem.code,
      title: row.problem.title,
      status: row.problem.status,
    },
    linkedBy: { id: row.linkedByUser.id, fullName: row.linkedByUser.fullName },
    linkedAt: row.linkedAt,
    unlinkedAt: row.unlinkedAt ?? undefined,
  };
}

@Injectable()
export class PrismaProblemRiskLinkReadAdapter implements ProblemRiskLinkReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByRisk(
    riskId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemRiskLinkReadRecord[]> {
    const rows = await this.prisma.client.problemRiskLink.findMany({
      where: includeWithdrawn ? { riskId } : { riskId, unlinkedAt: null },
      include: INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
