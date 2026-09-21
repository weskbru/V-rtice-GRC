/**
 * 008-incidents-problems, US3 (research.md D-14) — `ListIncidentProblemLinksUseCase`,
 * backing `GET /incidents/{incidentId}/problems`. READ-ONLY: `modules/incidents`
 * never writes to `ProblemIncidentLink` — `modules/problems` owns that
 * write path (`link-problem-incident.usecase.ts`). Mirrors the read half of
 * `link-incident-risk.usecase.ts`'s `ListIncidentRiskLinksUseCase` exactly.
 */
import { Injectable } from '@nestjs/common';

import { OrgScopeEnforcerService } from '../../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { UnauthorizedDomainError } from '../../../../shared/errors/domain-error';
import { IncidentDirectoryPort } from '../../../../shared/grc-ports/incident-directory.port';
import { IncidentProblemLinkReadPort } from '../../domain/ports/incident-problem-link-read.port';
import { IncidentReferenceDataPort } from '../../domain/ports/incident-reference-data.port';

import { resolveInScopeIncident } from './resolve-in-scope-incident';

import type { IncidentProblemLinkRecord } from '../../domain/incident-problem-link.entity';

export interface ListIncidentProblemLinksInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListIncidentProblemLinksUseCase {
  constructor(
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly linkReadPort: IncidentProblemLinkReadPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(
    input: ListIncidentProblemLinksInput,
  ): Promise<readonly IncidentProblemLinkRecord[]> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    await resolveInScopeIncident(
      this.incidentDirectory,
      this.scopeEnforcer,
      scope,
      input.actorUserId,
      input.incidentId,
    );

    return this.linkReadPort.listByIncident(input.incidentId, input.includeWithdrawn);
  }
}
