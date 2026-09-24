import { toApprovalResponse, type ApprovalResponse } from './approval-response.mapper';

import type {
  AvailableTransition,
  RiskLifecycleState,
} from '../../application/lifecycle/get-risk-lifecycle.usecase';
import type { RiskStatus } from '@prisma/client';

export interface AvailableTransitionResponse {
  readonly toStatus: RiskStatus;
  readonly requiredPermission: string;
  readonly requiresApproval: boolean;
  readonly preconditionsMet: boolean;
  readonly unmetPreconditions: readonly string[];
}

export interface RiskLifecycleStateResponse {
  readonly status: RiskStatus;
  readonly pendingApproval: ApprovalResponse | null;
  readonly availableTransitions: readonly AvailableTransitionResponse[];
  readonly traversedStatuses: readonly RiskStatus[];
}

function toAvailableTransitionResponse(
  transition: AvailableTransition,
): AvailableTransitionResponse {
  return {
    toStatus: transition.toStatus,
    requiredPermission: transition.requiredPermission,
    requiresApproval: transition.requiresApproval,
    preconditionsMet: transition.preconditionsMet,
    unmetPreconditions: transition.unmetPreconditions,
  };
}

export function toRiskLifecycleStateResponse(
  state: RiskLifecycleState,
): RiskLifecycleStateResponse {
  return {
    status: state.status,
    pendingApproval: state.pendingApproval ? toApprovalResponse(state.pendingApproval) : null,
    availableTransitions: state.availableTransitions.map(toAvailableTransitionResponse),
    traversedStatuses: state.traversedStatuses,
  };
}
