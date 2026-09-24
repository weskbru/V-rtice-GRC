import type { ProblemStatus } from '@prisma/client';

export interface IncidentProblemLinkProblemRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: ProblemStatus;
}

export interface IncidentProblemLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentProblemLinkRecord {
  readonly id: string;
  readonly incidentId: string;
  readonly problem: IncidentProblemLinkProblemRef;
  readonly linkedBy: IncidentProblemLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: IncidentProblemLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}
