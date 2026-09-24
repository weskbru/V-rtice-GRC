import type { IncidentStatus } from '@prisma/client';

export interface IncidentRefRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatus;
}

export interface IncidentLinkUserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentRiskLinkReadRecord {
  readonly id: string;
  readonly incident: IncidentRefRecord;
  readonly linkedBy: IncidentLinkUserRefRecord;
  readonly linkedAt: Date;
  readonly unlinkedAt: Date | undefined;
}

export abstract class IncidentRiskLinkReadPort {
  abstract listByRisk(
    riskId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentRiskLinkReadRecord[]>;
}
