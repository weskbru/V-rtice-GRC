import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RiskLifecycleTransitionRepositoryPort } from '../domain/ports/risk-lifecycle-transition-repository.port';

import type {
  CreateLifecycleTransitionInput,
  LifecycleTransitionRecord,
} from '../domain/ports/risk-lifecycle-transition-repository.port';
import type { Prisma, RiskStatus } from '@prisma/client';

const TRANSITION_INCLUDE = {
  performedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RiskLifecycleTransitionInclude;

type TransitionWithRelations = Prisma.RiskLifecycleTransitionGetPayload<{
  include: typeof TRANSITION_INCLUDE;
}>;

@Injectable()
export class RiskLifecycleTransitionRepository implements RiskLifecycleTransitionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateLifecycleTransitionInput): Promise<LifecycleTransitionRecord> {
    const created = await this.prisma.client.riskLifecycleTransition.create({
      data: {
        riskId: input.riskId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        performedByUserId: input.performedByUserId,
        performedAt: new Date(),
        justification: input.justification,
        approvalId: input.approvalId ?? null,
      },
      include: TRANSITION_INCLUDE,
    });

    return toRecord(created);
  }

  async findMostRecentInto(
    riskId: string,
    toStatus: RiskStatus,
  ): Promise<LifecycleTransitionRecord | undefined> {
    const row = await this.prisma.client.riskLifecycleTransition.findFirst({
      where: { riskId, toStatus },
      include: TRANSITION_INCLUDE,
      orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
    });

    return row ? toRecord(row) : undefined;
  }

  async listByRisk(riskId: string): Promise<readonly LifecycleTransitionRecord[]> {
    const rows = await this.prisma.client.riskLifecycleTransition.findMany({
      where: { riskId },
      include: TRANSITION_INCLUDE,
      orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
    });

    return rows.map(toRecord);
  }
}

function toRecord(row: TransitionWithRelations): LifecycleTransitionRecord {
  return {
    id: row.id,
    riskId: row.riskId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    performedBy: {
      id: row.performedByUser.id,
      fullName: row.performedByUser.fullName,
      email: row.performedByUser.email,
    },
    performedAt: row.performedAt,
    justification: row.justification,
    approvalId: row.approvalId,
  };
}
