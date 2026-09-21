/**
 * 013-incidents-problems-reverse-links — `ListProcessIncidentLinksUseCase`:
 * the read-only reverse side of `IncidentProcessLink`, backing
 * `GET /processes/{processId}/incidents`. `modules/processes` never writes
 * to this table — `modules/incidents` (`link-incident-process.usecase.ts`)
 * owns that write path.
 *
 * Mirrors `modules/assets`' own `ListAssetIncidentLinksUseCase` exactly.
 */
import { Injectable } from '@nestjs/common';

import { IncidentProcessLinkReadPort } from '../../../shared/grc-ports/incident-process-link-read.port';

import { GetProcessUseCase } from './get-process.usecase';

import type { IncidentProcessLinkReadRecord } from '../../../shared/grc-ports/incident-process-link-read.port';

export interface ListProcessIncidentLinksInput {
  readonly actorUserId: string;
  readonly processId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListProcessIncidentLinksUseCase {
  constructor(
    private readonly getProcessUseCase: GetProcessUseCase,
    private readonly incidentProcessLinkRead: IncidentProcessLinkReadPort,
  ) {}

  async execute(
    input: ListProcessIncidentLinksInput,
  ): Promise<readonly IncidentProcessLinkReadRecord[]> {
    await this.getProcessUseCase.execute({
      actorUserId: input.actorUserId,
      processId: input.processId,
    });
    return this.incidentProcessLinkRead.listByProcess(input.processId, input.includeWithdrawn);
  }
}
