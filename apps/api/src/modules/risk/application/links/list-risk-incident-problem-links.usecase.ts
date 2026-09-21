/**
 * 013-incidents-problems-reverse-links — `ListRiskIncidentLinksUseCase`/
 * `ListRiskProblemLinksUseCase`: the read-only reverse side of
 * `IncidentRiskLink`/`ProblemRiskLink`, backing
 * `GET /risks/{riskId}/incidents` and `GET /risks/{riskId}/problems`.
 * `modules/risk` never writes to either table — `modules/incidents`
 * (`link-incident-risk.usecase.ts`) and `modules/problems`
 * (`link-problem-risk.usecase.ts`) own those write paths respectively.
 *
 * Mirrors `modules/controls/application/links/list-control-links.usecase.ts`'s
 * own `ListControlRiskLinksUseCase` exactly: resolve the caller's access to
 * the SOURCE record they already hold (`GetRiskUseCase`, `risk:view` +
 * scope, gated on the controller) and then read the far side's link table
 * through its boundary port — no re-check of the caller's permission or
 * scope on the linked Incident/Problem itself (ADR-020 part 4: the exposed
 * ref is deliberately minimal — id/code/title/status only — so nothing the
 * far side would refuse to disclose is exposed here either).
 */
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
