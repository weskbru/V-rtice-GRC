/**
 * T092 — `GetRiskUseCase`: the read side of `GET /risks/{riskId}`.
 * No transaction and no `AuditRecorder` dependency of its OWN: a
 * successful read is still never audited (ADR-005 — `audit_event` records
 * actions, not views). A REFUSED read now is, on the scope-denial branch
 * only (F-38): `OrgScopeEnforcerService.assertExistingRecordAccessible`
 * opens its own short-lived transaction internally to record the `DENIED`
 * row, the same way `PermissionGuard` needs no transaction of its own to
 * let `AuditPermissionDenialRecorder` do the same — see that service's own
 * doc comment.
 */
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

    // FR-025/FR-030: a risk outside scope reads as `undefined`, mapped to
    // the same 404 as "does not exist" — no distinction is ever surfaced
    // to the caller. F-38: the distinction IS recorded server-side, via
    // `assertExistingRecordAccessible`, whenever the risk actually exists
    // outside `scope` (never for a genuinely unknown id).
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
