import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ControlAssessmentApprovalRepositoryPort } from '../domain/ports/control-assessment-approval-repository.port';

import type {
  ControlAssessmentApprovalRecord,
  CreateControlAssessmentApprovalInput,
  DecideControlAssessmentApprovalInput,
} from '../domain/ports/control-assessment-approval-repository.port';
import type { Prisma } from '@prisma/client';

const APPROVAL_INCLUDE = {
  requestedByUser: { select: { id: true, fullName: true, email: true } },
  decidedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ApprovalInclude;

type ApprovalWithRelations = Prisma.ApprovalGetPayload<{ include: typeof APPROVAL_INCLUDE }>;

function toRecord(row: ApprovalWithRelations): ControlAssessmentApprovalRecord {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
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
      : undefined,
    decidedAt: row.decidedAt ?? undefined,
    justification: row.justification ?? undefined,
  };
}

@Injectable()
export class ControlAssessmentApprovalRepository implements ControlAssessmentApprovalRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateControlAssessmentApprovalInput,
  ): Promise<ControlAssessmentApprovalRecord> {
    const created = await this.prisma.client.approval.create({
      data: {
        entityType: 'CONTROL_ASSESSMENT',
        entityId: input.entityId,
        requestedTransition: 'ATTEST',
        requestedByUserId: input.requestedByUserId,
        requestedAt: new Date(),
        justification: input.justification,
      },
      include: APPROVAL_INCLUDE,
    });
    return toRecord(created);
  }

  async findPendingByEntityId(
    assessmentId: string,
  ): Promise<ControlAssessmentApprovalRecord | undefined> {
    const row = await this.prisma.client.approval.findFirst({
      where: { entityType: 'CONTROL_ASSESSMENT', entityId: assessmentId, status: 'PENDING' },
      include: APPROVAL_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async findById(id: string): Promise<ControlAssessmentApprovalRecord | undefined> {
    const row = await this.prisma.client.approval.findUnique({
      where: { id },
      include: APPROVAL_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async listByEntityId(assessmentId: string): Promise<readonly ControlAssessmentApprovalRecord[]> {
    const rows = await this.prisma.client.approval.findMany({
      where: { entityType: 'CONTROL_ASSESSMENT', entityId: assessmentId },
      include: APPROVAL_INCLUDE,
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toRecord);
  }

  async decide(
    input: DecideControlAssessmentApprovalInput,
  ): Promise<ControlAssessmentApprovalRecord> {
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
