/**
 * T166/T167/US7 — `GetRiskHistoryUseCase`: the application-layer side of
 * `GET /risks/{riskId}/history` (`contracts/risks.openapi.yaml`'s
 * `getRiskHistory` operation). Requires `risk:view` and scope — enforced
 * exactly like `GetRiskUseCase`: an out-of-scope or nonexistent risk reads
 * as the SAME `NotFoundDomainError` (FR-025/FR-030, ADR-009 byte-identical
 * 404). No transaction and no audit entry — reads are not audited
 * (ADR-005).
 */
import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { RiskHistoryQueryPort } from '../domain/ports/risk-history-query.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';

import type {
  RiskHistoryEntryType,
  RiskHistoryPage,
} from '../domain/ports/risk-history-query.port';

const RISK_ENTITY_LABEL = 'Risco';

export interface GetRiskHistoryInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly types?: readonly RiskHistoryEntryType[] | undefined;
  readonly page: number;
  readonly pageSize: number;
}

@Injectable()
export class GetRiskHistoryUseCase {
  constructor(
    private readonly riskRepository: RiskRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly historyQuery: RiskHistoryQueryPort,
  ) {}

  async execute(input: GetRiskHistoryInput): Promise<RiskHistoryPage> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const risk = await this.riskRepository.findById(scope, input.riskId);
    if (!risk) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    return this.historyQuery.getHistory({
      riskId: input.riskId,
      types: input.types,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
