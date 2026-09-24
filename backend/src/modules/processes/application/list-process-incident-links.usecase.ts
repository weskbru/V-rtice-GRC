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
