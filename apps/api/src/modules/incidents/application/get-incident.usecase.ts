/**
 * 008-incidents-problems, US1 — `GetIncidentUseCase` (`getIncident`,
 * spec.md FR-014). Scoped read: an incident outside the caller's
 * organizational scope reads as `undefined` from the repository, turned
 * into an audited `NotFoundDomainError` here via
 * `OrgScopeEnforcerService.assertExistingRecordAccessible` (F-38) —
 * indistinguishable from a genuinely unknown id, keyed to the id the
 * caller actually supplied. Mirrors `grc/finding/application/
 * get-finding.usecase.ts` exactly.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { IncidentRepositoryPort } from '../domain/ports/incident-repository.port';

import type { IncidentRecord } from '../domain/ports/incident-repository.port';

export interface GetIncidentInput {
  readonly actorUserId: string;
  readonly incidentId: string;
}

@Injectable()
export class GetIncidentUseCase {
  constructor(
    private readonly incidentRepository: IncidentRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: GetIncidentInput): Promise<IncidentRecord> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const record = await this.incidentRepository.findById(scope, input.incidentId);
    if (!record) {
      // F-38: recorded server-side, via `assertExistingRecordAccessible`,
      // whenever the incident actually exists outside `scope`.
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.INCIDENT,
          entityId: input.incidentId,
          entityLabel: USER_MESSAGES.incidents.entityLabel,
        },
        () => this.incidentRepository.findOrgUnitIdUnscoped(input.incidentId),
      );
    }
    return record;
  }
}
