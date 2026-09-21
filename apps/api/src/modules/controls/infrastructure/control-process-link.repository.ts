/**
 * T037/003-controls-management, User Story 3 — the sole implementation of
 * `ControlProcessLinkRepositoryPort`. No scope predicate anywhere in this
 * file — the caller (`LinkControlToProcessUseCase`/
 * `UnlinkControlFromProcessUseCase`) has already resolved and
 * scope-checked the parent `Control`, and separately scope-checked the
 * referenced `Process` (ADR-020 part 4), before any of these run.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ControlProcessLinkRepositoryPort } from '../domain/ports/control-relationship-repository.port';

import type { ControlEntityLinkRecord } from '../domain/ports/control-relationship-repository.port';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  process: { select: { id: true, code: true, name: true } },
  linkedByUser: { select: { id: true, fullName: true, email: true } },
  unlinkedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ControlProcessLinkInclude;

type LinkWithRelations = Prisma.ControlProcessLinkGetPayload<{ include: typeof INCLUDE }>;

function toRecord(row: LinkWithRelations): ControlEntityLinkRecord {
  return {
    id: row.id,
    controlId: row.controlId,
    entity: { id: row.process.id, code: row.process.code, name: row.process.name },
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
export class ControlProcessLinkRepository implements ControlProcessLinkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLink(
    controlId: string,
    processId: string,
  ): Promise<ControlEntityLinkRecord | undefined> {
    const row = await this.prisma.client.controlProcessLink.findFirst({
      where: { controlId, processId, unlinkedAt: null },
      include: INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async create(
    controlId: string,
    processId: string,
    linkedByUserId: string,
  ): Promise<ControlEntityLinkRecord> {
    const created = await this.prisma.client.controlProcessLink.create({
      data: { controlId, processId, linkedByUserId, linkedAt: new Date() },
      include: INCLUDE,
    });
    return toRecord(created);
  }

  async findById(controlId: string, linkId: string): Promise<ControlEntityLinkRecord | undefined> {
    const row = await this.prisma.client.controlProcessLink.findFirst({
      where: { id: linkId, controlId },
      include: INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void> {
    await this.prisma.client.controlProcessLink.update({
      where: { id: linkId },
      data: { unlinkedAt, unlinkedByUserId },
    });
  }

  async listByControl(
    controlId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ControlEntityLinkRecord[]> {
    const rows = await this.prisma.client.controlProcessLink.findMany({
      where: includeWithdrawn ? { controlId } : { controlId, unlinkedAt: null },
      include: INCLUDE,
      orderBy: [{ linkedAt: 'desc' }],
    });
    return rows.map(toRecord);
  }
}
