import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';

import type { RiskRecord } from '../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';

export interface GetRiskInput {
  readonly actorUserId: string;
  readonly riskId: string;
}

@Injectable()
export class GetRiskUseCase {
  constructor(
    private readonly riskRepository: RiskRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: GetRiskInput): Promise<RiskRecord> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const record = await this.riskRepository.findById(scope, input.riskId);
    if (!record) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          entityLabel: RISK_ENTITY_LABEL,
        },
        () => this.riskRepository.findOrgUnitIdUnscoped(input.riskId),
      );
    }

    return record;
  }
}
