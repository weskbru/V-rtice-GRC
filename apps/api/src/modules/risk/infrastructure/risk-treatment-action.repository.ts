import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RiskTreatmentActionRepositoryPort } from '../domain/ports/risk-treatment-action-repository.port';

import type {
  CreateTreatmentActionLinkInput,
  TreatmentActionLinkRecord,
} from '../domain/ports/risk-treatment-action-repository.port';
import type { ActionStatus } from '@prisma/client';

const TERMINAL_ACTION_STATUSES: readonly ActionStatus[] = ['COMPLETED', 'CANCELLED'];

function toLinkRecord(row: {
  id: string;
  riskId: string;
  treatmentDecisionId: string | null;
  actionId: string;
  createdAt: Date;
  updatedAt: Date;
}): TreatmentActionLinkRecord {
  return {
    id: row.id,
    riskId: row.riskId,
    treatmentDecisionId: row.treatmentDecisionId,
    actionId: row.actionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class RiskTreatmentActionRepository implements RiskTreatmentActionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createLink(input: CreateTreatmentActionLinkInput): Promise<TreatmentActionLinkRecord> {
    const created = await this.prisma.client.riskTreatmentAction.create({
      data: {
        riskId: input.riskId,
        treatmentDecisionId: input.treatmentDecisionId,
        actionId: input.actionId,
      },
    });
    return toLinkRecord(created);
  }

  async findLink(riskId: string, actionId: string): Promise<TreatmentActionLinkRecord | undefined> {
    const row = await this.prisma.client.riskTreatmentAction.findFirst({
      where: { riskId, actionId },
    });
    return row ? toLinkRecord(row) : undefined;
  }

  async upsertTreatmentDecisionLink(
    riskId: string,
    actionId: string,
    treatmentDecisionId: string | null,
  ): Promise<TreatmentActionLinkRecord> {
    const existing = await this.prisma.client.riskTreatmentAction.findUnique({
      where: { actionId },
    });
    if (existing) {
      const updated = await this.prisma.client.riskTreatmentAction.update({
        where: { actionId },
        data: { treatmentDecisionId },
      });
      return toLinkRecord(updated);
    }
    return this.createLink({ riskId, treatmentDecisionId, actionId });
  }

  async findTreatmentDecisionIdsByActionIds(
    actionIds: readonly string[],
  ): Promise<ReadonlyMap<string, string | null>> {
    if (actionIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.client.riskTreatmentAction.findMany({
      where: { actionId: { in: [...actionIds] } },
      select: { actionId: true, treatmentDecisionId: true },
    });
    return new Map(rows.map((row) => [row.actionId, row.treatmentDecisionId]));
  }

  async findDecisionIdsWithOutstandingActions(
    decisionIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    if (decisionIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.client.riskTreatmentAction.findMany({
      where: {
        treatmentDecisionId: { in: [...decisionIds] },
        action: { status: { notIn: [...TERMINAL_ACTION_STATUSES] } },
      },
      select: { treatmentDecisionId: true },
      distinct: ['treatmentDecisionId'],
    });
    return new Set(
      rows.map((row) => row.treatmentDecisionId).filter((id): id is string => id !== null),
    );
  }
}
