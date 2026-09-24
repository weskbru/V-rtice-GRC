import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RiskTreatmentDecisionRepositoryPort } from '../domain/ports/risk-treatment-decision-repository.port';

import type {
  CreateTreatmentDecisionInput,
  TreatmentDecisionPage,
  TreatmentDecisionRecord,
} from '../domain/ports/risk-treatment-decision-repository.port';
import type { Prisma } from '@prisma/client';

const DECISION_INCLUDE = {
  decidedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RiskTreatmentDecisionInclude;

type DecisionWithRelations = Prisma.RiskTreatmentDecisionGetPayload<{
  include: typeof DECISION_INCLUDE;
}>;

@Injectable()
export class RiskTreatmentDecisionRepository implements RiskTreatmentDecisionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateTreatmentDecisionInput): Promise<TreatmentDecisionRecord> {
    const created = await this.prisma.client.riskTreatmentDecision.create({
      data: {
        riskId: input.riskId,
        strategy: input.strategy,
        description: input.description,
        deadline: input.deadline,
        decidedByUserId: input.decidedByUserId,
        decidedAt: new Date(),
      },
      include: DECISION_INCLUDE,
    });

    return toRecord(created);
  }

  async supersede(id: string, supersededById: string, supersededAt: Date): Promise<void> {
    await this.prisma.client.riskTreatmentDecision.update({
      where: { id },
      data: { supersededAt, supersededById },
    });
  }

  async findCurrentByRisk(riskId: string): Promise<TreatmentDecisionRecord | undefined> {
    const row = await this.prisma.client.riskTreatmentDecision.findFirst({
      where: { riskId, supersededAt: null },
      include: DECISION_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async findById(id: string): Promise<TreatmentDecisionRecord | undefined> {
    const row = await this.prisma.client.riskTreatmentDecision.findUnique({
      where: { id },
      include: DECISION_INCLUDE,
    });
    return row ? toRecord(row) : undefined;
  }

  async listByRisk(riskId: string, page: number, pageSize: number): Promise<TreatmentDecisionPage> {
    const [rows, total] = await Promise.all([
      this.prisma.client.riskTreatmentDecision.findMany({
        where: { riskId },
        include: DECISION_INCLUDE,
        orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.riskTreatmentDecision.count({ where: { riskId } }),
    ]);

    return { items: rows.map(toRecord), total };
  }
}

function toRecord(row: DecisionWithRelations): TreatmentDecisionRecord {
  return {
    id: row.id,
    riskId: row.riskId,
    strategy: row.strategy,
    description: row.description,
    deadline: row.deadline,
    decidedBy: {
      id: row.decidedByUser.id,
      fullName: row.decidedByUser.fullName,
      email: row.decidedByUser.email,
    },
    decidedAt: row.decidedAt,
    supersededAt: row.supersededAt,
  };
}
