import type { ActionTransitionOption } from '../../status';
import type { Action, ActionStatus } from '../../types';

export type ActionLifecycleTrackState = 'current' | 'completed' | 'available' | 'unavailable';

export interface ActionLifecycleTrackNode {
  readonly status: ActionStatus;
  readonly state: ActionLifecycleTrackState;
}

export interface ActionLifecycleTrackModel {
  readonly main: readonly ActionLifecycleTrackNode[];
  readonly cancelled: ActionLifecycleTrackNode | null;
}

export const ACTION_LIFECYCLE_MAIN_TRACK: readonly ActionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
];

type TrackFacts = Pick<Action, 'status' | 'completedAt'>;

function isProvablyCompleted(status: ActionStatus, action: TrackFacts): boolean {
  switch (status) {
    case 'OPEN':
      return action.status !== 'OPEN';
    case 'IN_PROGRESS':
      return false;
    case 'COMPLETED':
      return Boolean(action.completedAt);
    case 'CANCELLED':
      return false;
  }
}

function resolveMainTrackNode(
  status: ActionStatus,
  action: TrackFacts,
  availableTargets: ReadonlySet<ActionStatus>,
): ActionLifecycleTrackNode {
  if (status === action.status) {
    return { status, state: 'current' };
  }
  if (isProvablyCompleted(status, action)) {
    return { status, state: 'completed' };
  }
  if (availableTargets.has(status)) {
    return { status, state: 'available' };
  }
  return { status, state: 'unavailable' };
}

export function buildActionLifecycleTrack(
  action: TrackFacts,
  availableTransitions: readonly ActionTransitionOption[],
): ActionLifecycleTrackModel {
  const availableTargets = new Set(availableTransitions.map((option) => option.to));

  const main = ACTION_LIFECYCLE_MAIN_TRACK.map((status) =>
    resolveMainTrackNode(status, action, availableTargets),
  );

  const cancelled: ActionLifecycleTrackNode | null =
    action.status === 'CANCELLED' ? { status: 'CANCELLED', state: 'current' } : null;

  return { main, cancelled };
}
