import type { IncidentStatus } from '@prisma/client';

export interface ProblemIncidentLinkIncidentRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatus;
}

export interface ProblemIncidentLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface ProblemIncidentLinkRecord {
  readonly id: string;
  readonly problemId: string;
  readonly incident: ProblemIncidentLinkIncidentRef;
  readonly linkedBy: ProblemIncidentLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: ProblemIncidentLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}
