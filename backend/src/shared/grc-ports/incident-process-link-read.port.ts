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

export interface IncidentProcessLinkReadRecord {
  readonly id: string;
  readonly incident: IncidentRefRecord;
  readonly linkedBy: IncidentLinkUserRefRecord;
  readonly linkedAt: Date;
  readonly unlinkedAt: Date | undefined;
}

export abstract class IncidentProcessLinkReadPort {
  abstract listByProcess(
    processId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProcessLinkReadRecord[]>;
}
