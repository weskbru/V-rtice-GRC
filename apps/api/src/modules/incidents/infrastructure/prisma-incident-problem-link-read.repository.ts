/**
 * 008-incidents-problems, US3 (research.md D-14) — READ-ONLY implementation
 * of `IncidentProblemLinkReadPort`. Backs `GET /incidents/{incidentId}/problems`.
 *
 * This reads the `problemIncidentLink` Prisma model directly via a `select`
 * projection of the `problem` relation's own columns — it is a Prisma query
 * against the platform's one shared database, not a TypeScript import of
 * `modules/problems`. Same precedent as `grc/finding`'s cross-link reads:
 * the eslint-boundaries rule (ADR-011) constrains module-to-module code
 * imports, not shared-schema Prisma relations. `modules/problems` remains
 * the sole WRITE owner of this table (see the port's own header) — nothing
 * here creates or unlinks rows.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IncidentProblemLinkReadPort } from '../domain/ports/incident-problem-link-read.port';

import type { IncidentProblemLinkRecord } from '../domain/incident-problem-link.entity';
import type { Prisma } from '@prisma/client';

const INCIDENT_PROBLEM_LINK_INCLUDE = {
  problem: { select: { id: true, code: true, title: true, status: true } },
  linkedByUser: { select: { id: true, fullName: true } },
  unlinkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.ProblemIncidentLinkInclude;

type ProblemIncidentLinkWithRelations = Prisma.ProblemIncidentLinkGetPayload<{
  include: typeof INCIDENT_PROBLEM_LINK_INCLUDE;
}>;

function toRecord(row: ProblemIncidentLinkWithRelations): IncidentProblemLinkRecord {
  return {
    id: row.id,
    incidentId: row.incidentId,
    problem: {
      id: row.problem.id,
      code: row.problem.code,
      title: row.problem.title,
      status: row.problem.status,
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
export class PrismaIncidentProblemLinkReadRepository implements IncidentProblemLinkReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByIncident(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProblemLinkRecord[]> {
    const rows = await this.prisma.client.problemIncidentLink.findMany({
      where: includeWithdrawn ? { incidentId } : { incidentId, unlinkedAt: null },
      include: INCIDENT_PROBLEM_LINK_INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
