/**
 * T142 — the sole implementation of `RiskControlLinkRepositoryPort`/
 * `RiskProcessLinkRepositoryPort`/`RiskAssetLinkRepositoryPort`
 * (`domain/ports/risk-relationship-repository.port.ts`). No scope predicate
 * anywhere in this file — the caller (`Link*UseCase`) has already resolved
 * and scope-checked the parent `Risk` before any of these run, same
 * reasoning as `RiskAssessmentRepository`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  RiskAssetLinkRepositoryPort,
  RiskControlLinkRepositoryPort,
  RiskProcessLinkRepositoryPort,
} from '../domain/ports/risk-relationship-repository.port';

import type {
  ControlLinkRecord,
  EntityLinkRecord,
} from '../domain/ports/risk-relationship-repository.port';
import type { Prisma } from '@prisma/client';

const CONTROL_LINK_INCLUDE = {
  control: { select: { id: true, code: true, name: true } },
  linkedByUser: { select: { id: true, fullName: true, email: true } },
  unlinkedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RiskControlLinkInclude;

type ControlLinkWithRelations = Prisma.RiskControlLinkGetPayload<{
  include: typeof CONTROL_LINK_INCLUDE;
}>;

function toControlLinkRecord(row: ControlLinkWithRelations): ControlLinkRecord {
  return {
    id: row.id,
    riskId: row.riskId,
    control: { id: row.control.id, code: row.control.code, name: row.control.name },
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
      : null,
    unlinkedAt: row.unlinkedAt,
  };
}

@Injectable()
export class PrismaRiskControlLinkRepository implements RiskControlLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(riskId: string, controlId: string): Promise<ControlLinkRecord | undefined> {
    const row = await this.prisma.client.riskControlLink.findFirst({
      where: { riskId, controlId, unlinkedAt: null },
      include: CONTROL_LINK_INCLUDE,
    });
    return row ? toControlLinkRecord(row) : undefined;
  }

  async create(
    riskId: string,
    controlId: string,
    linkedByUserId: string,
  ): Promise<ControlLinkRecord> {
    const created = await this.prisma.client.riskControlLink.create({
      data: { riskId, controlId, linkedByUserId, linkedAt: new Date() },
      include: CONTROL_LINK_INCLUDE,
    });
    return toControlLinkRecord(created);
  }

  async findById(riskId: string, linkId: string): Promise<ControlLinkRecord | undefined> {
    const row = await this.prisma.client.riskControlLink.findFirst({
      where: { id: linkId, riskId },
      include: CONTROL_LINK_INCLUDE,
    });
    return row ? toControlLinkRecord(row) : undefined;
  }

  async unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void> {
    await this.prisma.client.riskControlLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
    });
  }

  async listByRisk(
    riskId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ControlLinkRecord[]> {
    const rows = await this.prisma.client.riskControlLink.findMany({
      where: includeWithdrawn ? { riskId } : { riskId, unlinkedAt: null },
      include: CONTROL_LINK_INCLUDE,
      orderBy: [{ linkedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toControlLinkRecord);
  }
}

const PROCESS_LINK_INCLUDE = {
  process: { select: { id: true, code: true, name: true } },
  linkedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RiskProcessLinkInclude;

type ProcessLinkWithRelations = Prisma.RiskProcessLinkGetPayload<{
  include: typeof PROCESS_LINK_INCLUDE;
}>;

function toProcessLinkRecord(row: ProcessLinkWithRelations): EntityLinkRecord {
  return {
    id: row.id,
    riskId: row.riskId,
    entity: { id: row.process.id, code: row.process.code, name: row.process.name },
    linkedBy: {
      id: row.linkedByUser.id,
      fullName: row.linkedByUser.fullName,
      email: row.linkedByUser.email,
    },
    linkedAt: row.linkedAt,
    unlinkedAt: row.unlinkedAt,
  };
}

@Injectable()
export class PrismaRiskProcessLinkRepository implements RiskProcessLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(riskId: string, processId: string): Promise<EntityLinkRecord | undefined> {
    const row = await this.prisma.client.riskProcessLink.findFirst({
      where: { riskId, processId, unlinkedAt: null },
      include: PROCESS_LINK_INCLUDE,
    });
    return row ? toProcessLinkRecord(row) : undefined;
  }

  async create(
    riskId: string,
    processId: string,
    linkedByUserId: string,
  ): Promise<EntityLinkRecord> {
    const created = await this.prisma.client.riskProcessLink.create({
      data: { riskId, processId, linkedByUserId, linkedAt: new Date() },
      include: PROCESS_LINK_INCLUDE,
    });
    return toProcessLinkRecord(created);
  }

  async findById(riskId: string, linkId: string): Promise<EntityLinkRecord | undefined> {
    const row = await this.prisma.client.riskProcessLink.findFirst({
      where: { id: linkId, riskId },
      include: PROCESS_LINK_INCLUDE,
    });
    return row ? toProcessLinkRecord(row) : undefined;
  }

  async unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void> {
    await this.prisma.client.riskProcessLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
    });
  }

  async listByRisk(riskId: string): Promise<readonly EntityLinkRecord[]> {
    const rows = await this.prisma.client.riskProcessLink.findMany({
      where: { riskId, unlinkedAt: null },
      include: PROCESS_LINK_INCLUDE,
      orderBy: [{ linkedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toProcessLinkRecord);
  }
}

const ASSET_LINK_INCLUDE = {
  asset: { select: { id: true, code: true, name: true } },
  linkedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RiskAssetLinkInclude;

type AssetLinkWithRelations = Prisma.RiskAssetLinkGetPayload<{
  include: typeof ASSET_LINK_INCLUDE;
}>;

function toAssetLinkRecord(row: AssetLinkWithRelations): EntityLinkRecord {
  return {
    id: row.id,
    riskId: row.riskId,
    entity: { id: row.asset.id, code: row.asset.code, name: row.asset.name },
    linkedBy: {
      id: row.linkedByUser.id,
      fullName: row.linkedByUser.fullName,
      email: row.linkedByUser.email,
    },
    linkedAt: row.linkedAt,
    unlinkedAt: row.unlinkedAt,
  };
}

@Injectable()
export class PrismaRiskAssetLinkRepository implements RiskAssetLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(riskId: string, assetId: string): Promise<EntityLinkRecord | undefined> {
    const row = await this.prisma.client.riskAssetLink.findFirst({
      where: { riskId, assetId, unlinkedAt: null },
      include: ASSET_LINK_INCLUDE,
    });
    return row ? toAssetLinkRecord(row) : undefined;
  }

  async create(riskId: string, assetId: string, linkedByUserId: string): Promise<EntityLinkRecord> {
    const created = await this.prisma.client.riskAssetLink.create({
      data: { riskId, assetId, linkedByUserId, linkedAt: new Date() },
      include: ASSET_LINK_INCLUDE,
    });
    return toAssetLinkRecord(created);
  }

  async findById(riskId: string, linkId: string): Promise<EntityLinkRecord | undefined> {
    const row = await this.prisma.client.riskAssetLink.findFirst({
      where: { id: linkId, riskId },
      include: ASSET_LINK_INCLUDE,
    });
    return row ? toAssetLinkRecord(row) : undefined;
  }

  async unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void> {
    await this.prisma.client.riskAssetLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
    });
  }

  async listByRisk(riskId: string): Promise<readonly EntityLinkRecord[]> {
    const rows = await this.prisma.client.riskAssetLink.findMany({
      where: { riskId, unlinkedAt: null },
      include: ASSET_LINK_INCLUDE,
      orderBy: [{ linkedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toAssetLinkRecord);
  }
}
