import type { UserRefRecord } from './risk-repository.port';
import type { TreatmentStrategy } from '@prisma/client';

export interface TreatmentDecisionRecord {
  readonly id: string;
  readonly riskId: string;
  readonly strategy: TreatmentStrategy;
  readonly description: string;
  readonly deadline: Date | null;
  readonly decidedBy: UserRefRecord;
  readonly decidedAt: Date;
  readonly supersededAt: Date | null;
}

export interface CreateTreatmentDecisionInput {
  readonly riskId: string;
  readonly strategy: TreatmentStrategy;
  readonly description: string;
  readonly deadline: Date | null;
  readonly decidedByUserId: string;
}

export interface TreatmentDecisionPage {
  readonly items: readonly TreatmentDecisionRecord[];
  readonly total: number;
}

export abstract class RiskTreatmentDecisionRepositoryPort {
  abstract create(input: CreateTreatmentDecisionInput): Promise<TreatmentDecisionRecord>;

  abstract supersede(id: string, supersededById: string, supersededAt: Date): Promise<void>;

  abstract findCurrentByRisk(riskId: string): Promise<TreatmentDecisionRecord | undefined>;

  abstract findById(id: string): Promise<TreatmentDecisionRecord | undefined>;

  abstract listByRisk(
    riskId: string,
    page: number,
    pageSize: number,
  ): Promise<TreatmentDecisionPage>;
}
