import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { applyScopeToWhere } from '../../../shared/persistence/scope-filter';
import { ControlAssessmentRepositoryPort } from '../domain/ports/control-assessment-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ControlAssessmentForEffectiveness } from '../domain/control-effectiveness.service';
import type {
  ControlAssessmentOriginLookup,
  ControlAssessmentRecord,
  CreateControlAssessmentInput,
} from '../domain/ports/control-assessment-repository.port';
import type { Prisma } from '@prisma/client';

const ASSESSMENT_INCLUDE = {
  assessorUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ControlAssessmentInclude;

type AssessmentWithRelations = Prisma.ControlAssessmentGetPayload<{
  include: typeof ASSESSMENT_INCLUDE;
}>;

function toRecord(row: AssessmentWithRelations): ControlAssessmentRecord {
  return {
    id: row.id,
    controlId: row.controlId,
    assessedOn: row.assessedOn,
    assessor: {
      id: row.assessorUser.id,
      fullName: row.assessorUser.fullName,
      email: row.assessorUser.email,
    },
    result: row.result,
    conclusion: row.conclusion,
    approvalId: row.approvalId ?? undefined,
    attestedAt: row.attestedAt ?? undefined,
    attestedByUserId: row.attestedByUserId ?? undefined,
    createdAt: row.createdAt,
  };
}

const NEWEST_FIRST = [
  { assessedOn: 'desc' },
  { createdAt: 'desc' },
] satisfies Prisma.ControlAssessmentOrderByWithRelationInput[];

@Injectable()
export class ControlAssessmentRepository implements ControlAssessmentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateControlAssessmentInput): Promise<ControlAssessmentRecord> {
    const created = await this.prisma.client.controlAssessment.create({
      data: {
        controlId: input.controlId,
        assessedOn: input.assessedOn,
        assessorUserId: input.assessorUserId,
        result: input.result,
        conclusion: input.conclusion,
      },
      include: ASSESSMENT_INCLUDE,
    });
    return toRecord(created);
  }

  async findById(controlId: string, id: string): Promise<ControlAssessmentRecord | undefined> {
    const row = await this.prisma.client.controlAssessment.findFirst({
      where: { id, controlId },
      include: ASSESSMENT_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async listByControl(
    controlId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: readonly ControlAssessmentRecord[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.prisma.client.controlAssessment.findMany({
        where: { controlId },
        include: ASSESSMENT_INCLUDE,
        orderBy: NEWEST_FIRST,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.controlAssessment.count({ where: { controlId } }),
    ]);
    return { items: rows.map(toRecord), total };
  }

  async listAllForEffectiveness(
    controlId: string,
  ): Promise<readonly ControlAssessmentForEffectiveness[]> {
    const rows = await this.prisma.client.controlAssessment.findMany({
      where: { controlId },
      select: { assessedOn: true, createdAt: true, result: true, attestedAt: true },
      orderBy: NEWEST_FIRST,
    });
    return rows.map((row) => ({
      assessedOn: row.assessedOn,
      createdAt: row.createdAt,
      result: row.result,
      attestedAt: row.attestedAt,
    }));
  }

  async setApprovalId(id: string, approvalId: string): Promise<void> {
    await this.prisma.client.controlAssessment.update({
      where: { id },
      data: { approvalId },
    });
  }

  async attest(id: string, attestedAt: Date, attestedByUserId: string): Promise<void> {
    await this.prisma.client.controlAssessment.update({
      where: { id },
      data: { attestedAt, attestedByUserId },
    });
  }

  async findForOrigin(assessmentId: string): Promise<ControlAssessmentOriginLookup | undefined> {
    const row = await this.prisma.client.controlAssessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        controlId: true,
        assessedOn: true,
        control: { select: { orgUnitId: true, code: true } },
      },
    });
    if (!row?.control.orgUnitId) {
      return undefined;
    }
    return {
      assessmentId: row.id,
      controlId: row.controlId,
      controlOrgUnitId: row.control.orgUnitId,
      controlCode: row.control.code,
      assessedOn: row.assessedOn,
    };
  }

  async listAssessmentIdsInScope(scope: ScopeFilter): Promise<readonly string[]> {
    const where = applyScopeToWhere<Prisma.ControlAssessmentWhereInput>(scope, 'orgUnitId', {});
    const rows = await this.prisma.client.controlAssessment.findMany({
      where,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
