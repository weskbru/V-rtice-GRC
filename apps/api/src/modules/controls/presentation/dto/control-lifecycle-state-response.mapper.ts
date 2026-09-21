/**
 * T023/003-controls-management — maps `ControlLifecycleState`
 * (`application/lifecycle/get-control-lifecycle.usecase.ts`) to
 * `contracts/controls.openapi.yaml`'s `ControlLifecycleState` wire shape.
 * The ONE place this aggregate becomes a response body (ADR-009).
 */
import type {
  AvailableControlTransition,
  ControlLifecycleState,
} from '../../application/lifecycle/get-control-lifecycle.usecase';
import type { ControlStatus } from '@prisma/client';

export interface AvailableControlTransitionResponse {
  readonly toStatus: ControlStatus;
  readonly requiredPermission: string;
  readonly preconditionsMet: boolean;
  readonly unmetPreconditions: readonly string[];
}

export interface ControlLifecycleStateResponse {
  readonly status: ControlStatus;
  readonly availableTransitions: readonly AvailableControlTransitionResponse[];
}

function toAvailableTransitionResponse(
  transition: AvailableControlTransition,
): AvailableControlTransitionResponse {
  return {
    toStatus: transition.toStatus,
    requiredPermission: transition.requiredPermission,
    preconditionsMet: transition.preconditionsMet,
    unmetPreconditions: transition.unmetPreconditions,
  };
}

export function toControlLifecycleStateResponse(
  state: ControlLifecycleState,
): ControlLifecycleStateResponse {
  return {
    status: state.status,
    availableTransitions: state.availableTransitions.map(toAvailableTransitionResponse),
  };
}
