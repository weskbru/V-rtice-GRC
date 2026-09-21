/**
 * 008-incidents-problems, US1 — `ListIncidentsUseCase` (`listIncidents`,
 * contracts/incidents.openapi.yaml). Scoped register listing, mirroring
 * `grc/finding/application/list-finding.usecase.ts`'s shape, plus the
 * `sort`/`direction` pair `IncidentRepositoryPort.list` declares (the
 * contract's own `sort`/`direction` query parameters) that Finding's own
 * list operation does not have.
 */
import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { IncidentRepositoryPort } from '../domain/ports/incident-repository.port';

import type {
  IncidentPageResult,
  IncidentSortField,
} from '../domain/ports/incident-repository.port';
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

export interface ListIncidentsInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: readonly IncidentStatus[] | undefined;
  readonly severity?: readonly IncidentSeverity[] | undefined;
  readonly search?: string | undefined;
  readonly orgUnitId?: string | undefined;
  readonly sort: IncidentSortField;
  readonly direction: 'asc' | 'desc';
}

@Injectable()
export class ListIncidentsUseCase {
  constructor(
    private readonly incidentRepository: IncidentRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListIncidentsInput): Promise<IncidentPageResult> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    return this.incidentRepository.list(
      scope,
      {
        status: input.status,
        severity: input.severity,
        search: input.search,
        orgUnitId: input.orgUnitId,
      },
      input.sort,
      input.direction,
      input.page,
      input.pageSize,
    );
  }
}
