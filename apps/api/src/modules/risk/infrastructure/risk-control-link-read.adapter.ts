/**
 * The sole implementation of `RiskControlLinkReadPort`
 * (`shared/grc-ports/risk-control-link-read.port.ts`, ADR-020 part 3).
 * `modules/risk` OWNS the `risk_control_links` table (and `risks`), so this
 * adapter is the one place in the platform allowed to query them on behalf
 * of another module — the mirror image of
 * `modules/controls/infrastructure/control-directory.adapter.ts` for the
 * opposite direction.
 *
 * Previously lived inside `modules/controls` (reading these two tables
 * directly from outside their owning module) — see the port's own header
 * for why. Moving the query here is a pure relocation: the Prisma
 * `where`/`include`/`orderBy` shape and the resulting
 * `RiskControlLinkReadRecord` are unchanged.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RiskControlLinkReadPort } from '../../../shared/grc-ports/risk-control-link-read.port';

import type { RiskControlLinkReadRecord } from '../../../shared/grc-ports/risk-control-link-read.port';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  risk: { select: { id: true, code: true, title: true } },
  linkedByUser: { select: { id: true, fullName: true, email: true } },
  unlinkedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RiskControlLinkInclude;

type LinkWithRelations = Prisma.RiskControlLinkGetPayload<{ include: typeof INCLUDE }>;

function toRecord(row: LinkWithRelations): RiskControlLinkReadRecord {
  return {
    id: row.id,
    risk: { id: row.risk.id, code: row.risk.code, title: row.risk.title },
    linkedBy: {
      id: row.linkedByUser.id,
      fullName: row.linkedByUser.fullName,
      email: row.linkedByUser.email,
    },
    linkedAt: row.linkedAt,
    unlinkedBy: row.unlinkedByUser
      ? {
          id: row.unlinkedByUser.id,
          fullName: row.unlinkedByUser.fullName,
          email: row.unlinkedByUser.email,
        }
      : undefined,
    unlinkedAt: row.unlinkedAt ?? undefined,
  };
}

@Injectable()
export class PrismaRiskControlLinkReadAdapter implements RiskControlLinkReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByControl(
    controlId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly RiskControlLinkReadRecord[]> {
    const rows = await this.prisma.client.riskControlLink.findMany({
      where: includeWithdrawn ? { controlId } : { controlId, unlinkedAt: null },
      include: INCLUDE,
      orderBy: [{ linkedAt: 'desc' }],
    });
    return rows.map(toRecord);
  }
}
