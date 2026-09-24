import type { IncidentTransitionOption } from '../../status';
import type { IncidentDetail, IncidentStatus } from '../../types';

export type IncidentLifecycleTrackState = 'current' | 'completed' | 'available' | 'unavailable';

export interface IncidentLifecycleTrackNode {
  readonly status: IncidentStatus;
  readonly state: IncidentLifecycleTrackState;
}

export interface IncidentLifecycleTrackModel {
  readonly main: readonly IncidentLifecycleTrackNode[];
  readonly cancelled: IncidentLifecycleTrackNode | null;
}

export const INCIDENT_LIFECYCLE_MAIN_TRACK: readonly IncidentStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

type TrackFacts = Pick<IncidentDetail, 'status' | 'resolvedAt' | 'closedAt'>;

function isProvablyCompleted(status: IncidentStatus, incident: TrackFacts): boolean {
  switch (status) {
    case 'OPEN':
      return incident.status !== 'OPEN';
    case 'IN_PROGRESS':
      return false;
    case 'RESOLVED':
      return Boolean(incident.resolvedAt);
    case 'CLOSED':
      return Boolean(incident.closedAt);
    case 'CANCELLED':
      return false;
  }
}

function resolveMainTrackNode(
  status: IncidentStatus,
  incident: TrackFacts,
  availableTargets: ReadonlySet<IncidentStatus>,
): IncidentLifecycleTrackNode {
  if (status === incident.status) {
    return { status, state: 'current' };
  }
  if (isProvablyCompleted(status, incident)) {
    return { status, state: 'completed' };
  }
  if (availableTargets.has(status)) {
    return { status, state: 'available' };
  }
  return { status, state: 'unavailable' };
}

export function buildIncidentLifecycleTrack(
  incident: TrackFacts,
  availableTransitions: readonly IncidentTransitionOption[],
): IncidentLifecycleTrackModel {
  const availableTargets = new Set(availableTransitions.map((option) => option.to));

  const main = INCIDENT_LIFECYCLE_MAIN_TRACK.map((status) =>
    resolveMainTrackNode(status, incident, availableTargets),
  );

  const cancelled: IncidentLifecycleTrackNode | null =
    incident.status === 'CANCELLED' ? { status: 'CANCELLED', state: 'current' } : null;

  return { main, cancelled };
}
