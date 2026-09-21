/**
 * 008-incidents-problems, US3 (spec.md FR-015a/D-14, data-model.md §2) —
 * READ-ONLY domain shape for `ProblemIncidentLink`, from the Incident
 * side. `modules/incidents` never writes to this table — `modules/problems`
 * owns the write path (`POST`/`DELETE /problems/{problemId}/incidents`);
 * this file exists only so `GET /incidents/{incidentId}/problems` can
 * project it (`contracts/incidents.openapi.yaml`'s
 * `IncidentProblemLinkResponse`).
 */
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
