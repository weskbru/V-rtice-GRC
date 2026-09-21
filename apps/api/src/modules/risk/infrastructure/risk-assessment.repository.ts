/**
 * T124 — the sole Prisma-backed implementation of
 * `RiskAssessmentRepositoryPort`. No `ScopedRepository` base here — see that
 * port's doc comment for why: access to `riskId` is already authorized by
 * the caller via `RiskRepositoryPort.findById(scope, riskId)` before either
 * method below is ever called, and `risk_assessments` has no `orgUnitId`
 * column of its own to scope against directly.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RiskAssessmentRepositoryPort } from '../domain/ports/risk-assessment-repository.port';

import type {
  AssessmentPage,
  AssessmentRecord,
  CreateAssessmentRecordInput,
} from '../domain/ports/risk-assessment-repository.port';
import type { Prisma } from '@prisma/client';

const ASSESSMENT_INCLUDE = {
  methodologyVersion: { select: { id: true, versionNumber: true } },
  assessedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RiskAssessmentInclude;

type AssessmentWithRelations = Prisma.RiskAssessmentGetPayload<{
  include: typeof ASSESSMENT_INCLUDE;
}>;

@Injectable()
export class RiskAssessmentRepository implements RiskAssessmentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAssessmentRecordInput): Promise<AssessmentRecord> {
    const created = await this.prisma.client.riskAssessment.create({
      data: {
        riskId: input.riskId,
        methodologyVersionId: input.methodologyVersionId,
        assessedByUserId: input.assessedByUserId,
        assessedOn: input.assessedOn,
        inherentProbability: input.inherentProbability,
        inherentImpact: input.inherentImpact,
        inherentScore: input.inherentScore,
        inherentLevel: input.inherentLevel,
        residualProbability: input.residualProbability,
        residualImpact: input.residualImpact,
        residualScore: input.residualScore,
        residualLevel: input.residualLevel,
        controlsConsidered: [...input.controlsConsidered],
        rationale: input.rationale,
        previousAssessmentId: input.previousAssessmentId,
      },
      include: ASSESSMENT_INCLUDE,
    });

    return toAssessmentRecord(created);
  }

  async findById(id: string): Promise<AssessmentRecord | undefined> {
    const row = await this.prisma.client.riskAssessment.findUnique({
      where: { id },
      include: ASSESSMENT_INCLUDE,
    });
    return row ? toAssessmentRecord(row) : undefined;
  }

  async listByRisk(riskId: string, page: number, pageSize: number): Promise<AssessmentPage> {
    const where: Prisma.RiskAssessmentWhereInput = { riskId };

    const [rows, total] = await Promise.all([
      this.prisma.client.riskAssessment.findMany({
        where,
        // `assessedOn DESC` (data-model.md §9's index) then `id DESC` as a
        // UUIDv7 insertion-order tiebreak for same-day reassessments — see
        // the Prisma model's own comment for why no separate `createdAt`
        // column is needed for this.
        orderBy: [{ assessedOn: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: ASSESSMENT_INCLUDE,
      }),
      this.prisma.client.riskAssessment.count({ where }),
    ]);

    return { items: rows.map(toAssessmentRecord), total };
  }
}

/** Exported so `risk.repository.ts` can map the `currentAssessment` relation
 * nested in `RiskRepository`'s own `findById` include tree onto the SAME
 * `AssessmentRecord` shape, rather than duplicating this conversion — one
 * business concept (an assessment), one mapping from its Prisma row
 * (CLAUDE.md §13.8, ADR-009's "one mapper" discipline extended to this
 * inward Prisma-to-domain conversion). */
export function toAssessmentRecord(row: AssessmentWithRelations): AssessmentRecord {
  return {
    id: row.id,
    riskId: row.riskId,
    methodologyVersion: {
      id: row.methodologyVersion.id,
      versionNumber: row.methodologyVersion.versionNumber,
    },
    assessedBy: {
      id: row.assessedByUser.id,
      fullName: row.assessedByUser.fullName,
      email: row.assessedByUser.email,
    },
    assessedOn: row.assessedOn,
    inherentProbability: row.inherentProbability,
    inherentImpact: row.inherentImpact,
    inherentScore: row.inherentScore,
    inherentLevel: row.inherentLevel,
    residualProbability: row.residualProbability,
    residualImpact: row.residualImpact,
    residualScore: row.residualScore,
    residualLevel: row.residualLevel,
    controlsConsidered: row.controlsConsidered,
    rationale: row.rationale,
    previousAssessmentId: row.previousAssessmentId,
  };
}
