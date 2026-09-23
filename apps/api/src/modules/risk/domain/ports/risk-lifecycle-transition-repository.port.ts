import type { UserRefRecord } from './risk-repository.port';
import type { RiskStatus } from '@prisma/client';

export interface LifecycleTransitionRecord {
  readonly id: string;
  readonly riskId: string;
  readonly fromStatus: RiskStatus;
  readonly toStatus: RiskStatus;
  readonly performedBy: UserRefRecord;
  readonly performedAt: Date;
  readonly justification: string | null;
  readonly approvalId: string | null;
}

export interface CreateLifecycleTransitionInput {
  readonly riskId: string;
  readonly fromStatus: RiskStatus;
  readonly toStatus: RiskStatus;
  readonly performedByUserId: string;
  readonly justification: string | null;
  readonly approvalId?: string | null;
}

export abstract class RiskLifecycleTransitionRepositoryPort {
  abstract create(input: CreateLifecycleTransitionInput): Promise<LifecycleTransitionRecord>;

  abstract findMostRecentInto(
    riskId: string,
    toStatus: RiskStatus,
  ): Promise<LifecycleTransitionRecord | undefined>;

  abstract listByRisk(riskId: string): Promise<readonly LifecycleTransitionRecord[]>;
}
