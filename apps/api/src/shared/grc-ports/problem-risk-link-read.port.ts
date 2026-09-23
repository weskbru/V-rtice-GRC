import type { ProblemStatus } from '@prisma/client';

export interface ProblemRefRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: ProblemStatus;
}

export interface ProblemLinkUserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface ProblemRiskLinkReadRecord {
  readonly id: string;
  readonly problem: ProblemRefRecord;
  readonly linkedBy: ProblemLinkUserRefRecord;
  readonly linkedAt: Date;
  readonly unlinkedAt: Date | undefined;
}

export abstract class ProblemRiskLinkReadPort {
  abstract listByRisk(
    riskId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemRiskLinkReadRecord[]>;
}
