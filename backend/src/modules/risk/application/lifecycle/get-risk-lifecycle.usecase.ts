import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { ApprovalRepositoryPort } from '../../domain/ports/approval-repository.port';
import { RiskLifecycleTransitionRepositoryPort } from '../../domain/ports/risk-lifecycle-transition-repository.port';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { listLifecycleTransitionsFrom } from '../../domain/risk-lifecycle';
import { evaluatePreconditions } from '../../domain/transition-preconditions';

import { resolveReassessedDuringReview } from './reassessed-during-review';

import type { PermissionIdentifier } from '../../../../core/authorization/domain/permissions';
import type { ApprovalRecord } from '../../domain/ports/approval-repository.port';
import type { LifecycleTransitionRecord } from '../../domain/ports/risk-lifecycle-transition-repository.port';
import type { RiskStatus } from '@prisma/client';

const RISK_ENTITY_LABEL = 'Risco';

const RISK_STATUS_ORDER: readonly RiskStatus[] = [
  'DRAFT',
  'IDENTIFIED',
  'ASSESSED',
  'UNDER_TREATMENT',
  'UNDER_REVIEW',
  'ACCEPTED',
  'CLOSED',
  'ARCHIVED',
];

function deriveTraversedStatuses(
  transitions: readonly LifecycleTransitionRecord[],
): readonly RiskStatus[] {
  const traversed = new Set<RiskStatus>(['DRAFT']);
  for (const transition of transitions) {
    traversed.add(transition.fromStatus);
    traversed.add(transition.toStatus);
  }
  return RISK_STATUS_ORDER.filter((status) => traversed.has(status));
}

export interface GetRiskLifecycleInput {
  readonly actorUserId: string;
  readonly riskId: string;
}

export interface AvailableTransition {
  readonly toStatus: RiskStatus;
  readonly requiredPermission: PermissionIdentifier;
  readonly requiresApproval: boolean;
  readonly preconditionsMet: boolean;
  readonly unmetPreconditions: readonly string[];
}

export interface RiskLifecycleState {
  readonly status: RiskStatus;
  readonly pendingApproval: ApprovalRecord | undefined;
  readonly availableTransitions: readonly AvailableTransition[];
  readonly traversedStatuses: readonly RiskStatus[];
}

@Injectable()
export class GetRiskLifecycleUseCase {
  constructor(
    private readonly riskRepository: RiskRepositoryPort,
    private readonly transitionRepository: RiskLifecycleTransitionRepositoryPort,
    private readonly approvalRepository: ApprovalRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: GetRiskLifecycleInput): Promise<RiskLifecycleState> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const risk = await this.riskRepository.findById(scope, input.riskId);
    if (!risk) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    const [pendingApproval, permissions, reassessedDuringReview, transitions] = await Promise.all([
      risk.pendingApprovalId !== undefined
        ? this.approvalRepository.findById(risk.pendingApprovalId)
        : Promise.resolve(undefined),
      this.permissionResolver.getEffectivePermissions(input.actorUserId),
      resolveReassessedDuringReview(this.transitionRepository, risk),
      this.transitionRepository.listByRisk(risk.id),
    ]);

    const availableTransitions = listLifecycleTransitionsFrom(risk.status)
      .filter((rule) => permissions.has(rule.requiredPermission))
      .map((rule) => {
        const results = evaluatePreconditions(rule.preconditions, {
          risk,
          reassessedDuringReview,
        });
        const unmet = results.filter((result) => !result.met);

        return {
          toStatus: rule.to,
          requiredPermission: rule.requiredPermission,
          requiresApproval: rule.requiresApproval,
          preconditionsMet: unmet.length === 0,
          unmetPreconditions: unmet.map((result) => result.message),
        };
      });

    return {
      status: risk.status,
      pendingApproval,
      availableTransitions,
      traversedStatuses: deriveTraversedStatuses(transitions),
    };
  }
}
