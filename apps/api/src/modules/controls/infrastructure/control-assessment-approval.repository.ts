/**
 * T029-T030/003-controls-management, User Story 2 — the sole
 * implementation of `ControlAssessmentApprovalRepositoryPort`, against the
 * SAME generic `approvals` table `modules/risk/infrastructure/
 * approval.repository.ts` writes, scoped to `entityType:
 * 'CONTROL_ASSESSMENT'`. No scope predicate anywhere in this file — the
 * caller has already resolved and scope-checked the parent `Control`
 * before any of these run.
 */
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
        // No transition string applies to an assessment attestation (it
        // is a declare-effective/not decision, not a state machine move,
        // research.md D-6's own "Descartado explicitamente" for the
        // control's own lifecycle applies equally here) — a fixed literal
        // documents what this approval is FOR without inventing a
        // per-assessment state pair the way `Risk`'s own
        // `${fromStatus}->${toStatus}` does.
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
