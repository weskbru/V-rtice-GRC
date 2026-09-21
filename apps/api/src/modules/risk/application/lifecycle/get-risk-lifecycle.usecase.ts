/**
 * T159 — `GetRiskLifecycleUseCase`: the read side of
 * `GET /risks/{riskId}/lifecycle` (`contracts/risks.openapi.yaml`'s
 * `getRiskLifecycle` operation, ADR-006, FR-080, FR-082, FR-029c). No
 * transaction and no audit entry — reads are not audited (ADR-005).
 *
 * ## Filtering by BOTH current state and the caller's permissions (FR-082)
 *
 * `listLifecycleTransitionsFrom(risk.status)` gives every transition that
 * is valid from where the risk IS. That list is then filtered to keep only
 * rows whose `requiredPermission` is in the caller's effective permission
 * set (`PermissionResolverService.getEffectivePermissions` — the SAME
 * resolver `PermissionGuard` itself uses, ADR-003) — a caller without
 * `risk:transition`, for example, never sees `UNDER_REVIEW`/`ACCEPTED`/
 * `CLOSED` in `availableTransitions` at all, even though those pairs may be
 * structurally legal from the current state. This is deliberate: FR-082
 * says the interface must offer only transitions "valid from the current
 * state AND permitted to the current user" — a caller who cannot perform a
 * transition must not be offered a button for it, "an over-permissive
 * answer becomes a button that fails" (this task's own framing). The
 * REFUSAL a caller without the permission would get from `POST
 * .../transitions` is `403`; this endpoint prevents the button from ever
 * appearing in the first place, which is the UI-facing half of the SAME
 * guarantee `PerformTransitionUseCase`'s own permission check enforces
 * server-side regardless of what this endpoint says (the contract's own
 * "advisory: the server re-evaluates on every transition request").
 *
 * `preconditionsMet`/`unmetPreconditions` reuse the EXACT SAME
 * `evaluatePreconditions` call `PerformTransitionUseCase`/
 * `RequestApprovalUseCase` use before actually applying a transition — this
 * endpoint can never claim a precondition is met when the write path would
 * refuse it, because both read the same pure function against the same
 * risk state.
 */
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

/** Canonical left-to-right reading order for the lifecycle spine — the same
 * order `RiskStatus` is declared in `schema.prisma`. `deriveTraversedStatuses`
 * filters this fixed order down to what the history proves, rather than
 * emitting statuses in transition-log order, so the UI never has to re-sort
 * a set before rendering it as a sequence. */
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

/** Every status `transitions` proves the risk actually occupied — the union
 * of every `fromStatus`/`toStatus` pair, plus `DRAFT` (every risk starts
 * there, whether or not `listByRisk` returns anything: a never-transitioned
 * risk has traversed exactly `[DRAFT]`). */
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
  /**
   * F-CV-3: every status this risk's history proves it actually passed
   * through, derived from `RiskLifecycleTransitionRepositoryPort.listByRisk`
   * — the append-only, database-immutable transition log — never inferred
   * from `status` alone. `DRAFT` is always included: every risk starts
   * there, whether or not it has transitioned since (a risk with zero
   * transitions has traversed exactly `[DRAFT]`). Computed here, once, so
   * the client never has to reconstruct "did this risk pass through X" by
   * guessing from the current status — the exact confusion that made an
   * ARCHIVED risk's own UNDER_TREATMENT step read as "never happened"
   * instead of "not available now".
   */
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
