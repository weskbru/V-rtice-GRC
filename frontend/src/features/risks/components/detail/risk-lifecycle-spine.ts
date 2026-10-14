import type { AvailableRiskTransition, RiskStatus } from '../../types';

export type RiskLifecycleSpineState =
  'current' | 'traversed' | 'available' | 'blocked' | 'unavailable';

export interface RiskLifecycleSpineNode {
  readonly status: RiskStatus;
  readonly state: RiskLifecycleSpineState;
  readonly unmetPreconditions?: readonly string[];
}

export interface RiskLifecycleSpineModel {
  readonly main: readonly RiskLifecycleSpineNode[];
  readonly branches: readonly RiskLifecycleSpineNode[];
}

export const RISK_LIFECYCLE_MAIN_SPINE: readonly RiskStatus[] = [
  'DRAFT',
  'IDENTIFIED',
  'ASSESSED',
  'UNDER_TREATMENT',
  'CLOSED',
  'ARCHIVED',
];

export const RISK_LIFECYCLE_BRANCHES: readonly RiskStatus[] = ['UNDER_REVIEW', 'ACCEPTED'];

export function resolveRiskLifecycleSpineNode(
  status: RiskStatus,
  currentStatus: RiskStatus,
  availableTransitions: readonly AvailableRiskTransition[],
  traversedStatuses: ReadonlySet<RiskStatus>,
): RiskLifecycleSpineNode {
  if (status === currentStatus) {
    return { status, state: 'current' };
  }
  if (traversedStatuses.has(status)) {
    return { status, state: 'traversed' };
  }
  const transition = availableTransitions.find((candidate) => candidate.toStatus === status);
  if (!transition) {
    return { status, state: 'unavailable' };
  }
  return transition.preconditionsMet
    ? { status, state: 'available' }
    : { status, state: 'blocked', unmetPreconditions: transition.unmetPreconditions };
}

export function buildRiskLifecycleSpine(
  currentStatus: RiskStatus,
  availableTransitions: readonly AvailableRiskTransition[],
  traversedStatuses: readonly RiskStatus[],
): RiskLifecycleSpineModel {
  const traversed = new Set(traversedStatuses);
  return {
    main: RISK_LIFECYCLE_MAIN_SPINE.map((status) =>
      resolveRiskLifecycleSpineNode(status, currentStatus, availableTransitions, traversed),
    ),
    branches: RISK_LIFECYCLE_BRANCHES.map((status) =>
      resolveRiskLifecycleSpineNode(status, currentStatus, availableTransitions, traversed),
    ),
  };
}
