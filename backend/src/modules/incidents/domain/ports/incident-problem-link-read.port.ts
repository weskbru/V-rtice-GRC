import type { IncidentProblemLinkRecord } from '../incident-problem-link.entity';

export abstract class IncidentProblemLinkReadPort {
  abstract listByIncident(
    incidentId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentProblemLinkRecord[]>;
}
