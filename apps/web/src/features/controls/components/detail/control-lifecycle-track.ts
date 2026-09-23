import type { AvailableControlTransition, ControlStatus } from '../../types';

export type ControlLifecycleTrackState = 'current' | 'completed' | 'available' | 'unavailable';

export interface ControlLifecycleTrackNode {
  readonly status: ControlStatus;
  readonly state: ControlLifecycleTrackState;
}

export interface ControlLifecycleTrackModel {
  readonly main: readonly ControlLifecycleTrackNode[];
  readonly retired: ControlLifecycleTrackNode | null;
}

export const CONTROL_LIFECYCLE_MAIN_TRACK: readonly ControlStatus[] = [
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
];

interface TrackFacts {
  readonly status: ControlStatus;
}

function isProvablyCompleted(status: ControlStatus, control: TrackFacts): boolean {
  switch (status) {
    case 'DRAFT':
      return control.status !== 'DRAFT';
    case 'ACTIVE':
      return control.status === 'SUSPENDED';
    case 'SUSPENDED':
      return false;
    case 'RETIRED':
      return false;
  }
}

function resolveMainTrackNode(
  status: ControlStatus,
  control: TrackFacts,
  availableTargets: ReadonlySet<ControlStatus>,
): ControlLifecycleTrackNode {
  if (status === control.status) {
    return { status, state: 'current' };
  }
  if (isProvablyCompleted(status, control)) {
    return { status, state: 'completed' };
  }
  if (availableTargets.has(status)) {
    return { status, state: 'available' };
  }
  return { status, state: 'unavailable' };
}

export function buildControlLifecycleTrack(
  control: TrackFacts,
  availableTransitions: readonly AvailableControlTransition[],
): ControlLifecycleTrackModel {
  const availableTargets = new Set(availableTransitions.map((transition) => transition.toStatus));

  const main = CONTROL_LIFECYCLE_MAIN_TRACK.map((status) =>
    resolveMainTrackNode(status, control, availableTargets),
  );

  const retired: ControlLifecycleTrackNode | null =
    control.status === 'RETIRED' ? { status: 'RETIRED', state: 'current' } : null;

  return { main, retired };
}
