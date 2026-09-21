/**
 * 013-incidents-problems-reverse-links — the REVERSE direction of the
 * Incident<->Process relationship: `modules/processes` reading the
 * `IncidentProcessLink` row that `modules/incidents` owns
 * (`GET /processes/{processId}/incidents`). Mirrors
 * `incident-risk-link-read.port.ts` exactly, against `Process` instead of
 * `Risk` — see that file's own header for the full reasoning this one
 * deliberately does not repeat.
 *
 * "Read-only by design": `IncidentProcessLink` is created/withdrawn only
 * from `POST`/`DELETE /incidents/{incidentId}/processes` on the Incident
 * side.
 */
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
  // No `unlinkedBy` — mirrors `IncidentRiskLinkResponse`/`IncidentProblemLinkResponse`'s
  // own precedent (incidents.openapi.yaml): who withdrew the link is not
  // exposed on this same entity's reverse read either, only that it was.
  readonly unlinkedAt: Date | undefined;
}

export abstract class IncidentProcessLinkReadPort {
  abstract listByProcess(
    processId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProcessLinkReadRecord[]>;
}
