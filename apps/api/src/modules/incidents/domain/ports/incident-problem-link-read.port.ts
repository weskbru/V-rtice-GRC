/**
 * 008-incidents-problems, US3 (research.md D-14) — READ-ONLY port for
 * `ProblemIncidentLink`, from the Incident side. `modules/incidents` never
 * writes to this table (`modules/problems` owns the write path); this port
 * exists only to back `GET /incidents/{incidentId}/problems`.
 *
 * `modules/incidents/infrastructure/prisma-incident-problem-link-read.repository.ts`
 * is the sole implementation.
 */
import type { IncidentProblemLinkRecord } from '../incident-problem-link.entity';

export abstract class IncidentProblemLinkReadPort {
  abstract listByIncident(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProblemLinkRecord[]>;
}
