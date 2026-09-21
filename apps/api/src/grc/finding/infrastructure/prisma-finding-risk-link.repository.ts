/**
 * T061/005-audit-findings, US3 — the sole implementation of
 * `FindingRiskLinkRepositoryPort`. Sibling of
 * `prisma-finding-control-link.repository.ts`, same reasoning.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { FindingRiskLinkRepositoryPort } from '../domain/ports/finding-risk-link-repository.port';

import type { FindingRiskLinkRecord } from '../domain/finding-risk-link.entity';
import type { Prisma } from '@prisma/client';

const FINDING_RISK_LINK_INCLUDE = {
  risk: { select: { id: true, code: true, title: true } },
  linkedByUser: { select: { id: true, fullName: true } },
  unlinkedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.FindingRiskLinkInclude;

type FindingRiskLinkWithRelations = Prisma.FindingRiskLinkGetPayload<{
  include: typeof FINDING_RISK_LINK_INCLUDE;
}>;

function toRecord(row: FindingRiskLinkWithRelations): FindingRiskLinkRecord {
  return {
    id: row.id,
    findingId: row.findingId,
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
export class PrismaFindingRiskLinkRepository implements FindingRiskLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(
    findingId: string,
    riskId: string,
  ): Promise<FindingRiskLinkRecord | undefined> {
    const row = await this.prisma.client.findingRiskLink.findFirst({
      where: { findingId, riskId, unlinkedAt: null },
      include: FINDING_RISK_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    findingId: string,
    riskId: string,
    linkedByUserId: string,
  ): Promise<FindingRiskLinkRecord> {
    const created = await this.prisma.client.findingRiskLink.create({
      data: { findingId, riskId, linkedByUserId, linkedAt: new Date() },
      include: FINDING_RISK_LINK_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(findingId: string, linkId: string): Promise<FindingRiskLinkRecord | undefined> {
    const row = await this.prisma.client.findingRiskLink.findFirst({
      where: { id: linkId, findingId },
      include: FINDING_RISK_LINK_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<FindingRiskLinkRecord> {
    const updated = await this.prisma.client.findingRiskLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
      include: FINDING_RISK_LINK_INCLUDE,
    });
    return toRecord(updated);
  }

  async listByFinding(
    findingId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly FindingRiskLinkRecord[]> {
    const rows = await this.prisma.client.findingRiskLink.findMany({
      where: includeWithdrawn ? { findingId } : { findingId, unlinkedAt: null },
      include: FINDING_RISK_LINK_INCLUDE,
      orderBy: { linkedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
