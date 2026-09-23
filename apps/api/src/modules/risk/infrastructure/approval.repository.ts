import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ApprovalRepositoryPort } from '../domain/ports/approval-repository.port';

import type {
  ApprovalRecord,
  CreateApprovalInput,
  DecideApprovalInput,
} from '../domain/ports/approval-repository.port';
import type { ApprovableEntityType, Prisma } from '@prisma/client';

const APPROVAL_INCLUDE = {
  requestedByUser: { select: { id: true, fullName: true, email: true } },
  decidedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ApprovalInclude;

type ApprovalWithRelations = Prisma.ApprovalGetPayload<{ include: typeof APPROVAL_INCLUDE }>;

@Injectable()
export class ApprovalRepository implements ApprovalRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateApprovalInput): Promise<ApprovalRecord> {
    const created = await this.prisma.client.approval.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        requestedTransition: input.requestedTransition,
        requestedByUserId: input.requestedByUserId,
        requestedAt: new Date(),
        justification: input.justification,
      },
      include: APPROVAL_INCLUDE,
    });

    return toRecord(created);
  }

  async findById(id: string): Promise<ApprovalRecord | undefined> {
    const row = await this.prisma.client.approval.findUnique({
      where: { id },
      include: APPROVAL_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async findPendingByEntity(
    entityType: ApprovableEntityType,
    entityId: string,
  ): Promise<ApprovalRecord | undefined> {
    const row = await this.prisma.client.approval.findFirst({
      where: { entityType, entityId, status: 'PENDING' },
      include: APPROVAL_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async listByEntity(
    entityType: ApprovableEntityType,
    entityId: string,
  ): Promise<readonly ApprovalRecord[]> {
    const rows = await this.prisma.client.approval.findMany({
      where: { entityType, entityId },
      include: APPROVAL_INCLUDE,
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toRecord);
  }

  async decide(input: DecideApprovalInput): Promise<ApprovalRecord> {
    const updated = await this.prisma.client.approval.update({
      where: { id: input.id },
      data: {
        status: input.status,
        decidedByUserId: input.decidedByUserId,
        decidedAt: new Date(),
        justification: input.justification,
      },
      include: APPROVAL_INCLUDE,
    });

    return toRecord(updated);
  }
}

function toRecord(row: ApprovalWithRelations): ApprovalRecord {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    requestedTransition: row.requestedTransition,
    requestedBy: {
      id: row.requestedByUser.id,
      fullName: row.requestedByUser.fullName,
      email: row.requestedByUser.email,
    },
    requestedAt: row.requestedAt,
    status: row.status,
    decidedBy: row.decidedByUser
      ? {
          id: row.decidedByUser.id,
          fullName: row.decidedByUser.fullName,
          email: row.decidedByUser.email,
        }
      : null,
    decidedAt: row.decidedAt,
    justification: row.justification,
  };
}
