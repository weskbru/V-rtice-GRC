import { Injectable } from '@nestjs/common';

import { IncidentRiskLinkReadPort } from '../../../../shared/grc-ports/incident-risk-link-read.port';
import { ProblemRiskLinkReadPort } from '../../../../shared/grc-ports/problem-risk-link-read.port';
import { GetRiskUseCase } from '../get-risk.usecase';

import type { IncidentRiskLinkReadRecord } from '../../../../shared/grc-ports/incident-risk-link-read.port';
import type { ProblemRiskLinkReadRecord } from '../../../../shared/grc-ports/problem-risk-link-read.port';

export interface ListRiskLinksInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListRiskIncidentLinksUseCase {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly incidentRiskLinkRead: IncidentRiskLinkReadPort,
  ) {}

  async execute(input: ListRiskLinksInput): Promise<readonly IncidentRiskLinkReadRecord[]> {
    await this.getRiskUseCase.execute({ actorUserId: input.actorUserId, riskId: input.riskId });
    return this.incidentRiskLinkRead.listByRisk(input.riskId, input.includeWithdrawn);
  }
}

@Injectable()
export class ListRiskProblemLinksUseCase {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly problemRiskLinkRead: ProblemRiskLinkReadPort,
  ) {}

  async execute(input: ListRiskLinksInput): Promise<readonly ProblemRiskLinkReadRecord[]> {
    await this.getRiskUseCase.execute({ actorUserId: input.actorUserId, riskId: input.riskId });
    return this.problemRiskLinkRead.listByRisk(input.riskId, input.includeWithdrawn);
  }
}
