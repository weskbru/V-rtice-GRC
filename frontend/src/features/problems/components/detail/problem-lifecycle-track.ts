import type { ProblemTransitionOption } from '../../status';
import type { ProblemDetail, ProblemStatus } from '../../types';

export type ProblemLifecycleTrackState = 'current' | 'completed' | 'available' | 'unavailable';

export interface ProblemLifecycleTrackNode {
  readonly status: ProblemStatus;
  readonly state: ProblemLifecycleTrackState;
}

export interface ProblemLifecycleTrackModel {
  readonly main: readonly ProblemLifecycleTrackNode[];
  readonly cancelled: ProblemLifecycleTrackNode | null;
}

export const PROBLEM_LIFECYCLE_MAIN_TRACK: readonly ProblemStatus[] = [
  'OPEN',
  'IN_ANALYSIS',
  'RESOLVED',
  'CLOSED',
];

type TrackFacts = Pick<ProblemDetail, 'status' | 'resolvedAt' | 'closedAt'>;

function isProvablyCompleted(status: ProblemStatus, problem: TrackFacts): boolean {
  switch (status) {
    case 'OPEN':
      return problem.status !== 'OPEN';
    case 'IN_ANALYSIS':
      return false;
    case 'RESOLVED':
      return Boolean(problem.resolvedAt);
    case 'CLOSED':
      return Boolean(problem.closedAt);
    case 'CANCELLED':
      return false;
  }
}

function resolveMainTrackNode(
  status: ProblemStatus,
  problem: TrackFacts,
  availableTargets: ReadonlySet<ProblemStatus>,
): ProblemLifecycleTrackNode {
  if (status === problem.status) {
    return { status, state: 'current' };
  }
  if (isProvablyCompleted(status, problem)) {
    return { status, state: 'completed' };
  }
  if (availableTargets.has(status)) {
    return { status, state: 'available' };
  }
  return { status, state: 'unavailable' };
}

export function buildProblemLifecycleTrack(
  problem: TrackFacts,
  availableTransitions: readonly ProblemTransitionOption[],
): ProblemLifecycleTrackModel {
  const availableTargets = new Set(availableTransitions.map((option) => option.to));

  const main = PROBLEM_LIFECYCLE_MAIN_TRACK.map((status) =>
    resolveMainTrackNode(status, problem, availableTargets),
  );

  const cancelled: ProblemLifecycleTrackNode | null =
    problem.status === 'CANCELLED' ? { status: 'CANCELLED', state: 'current' } : null;

  return { main, cancelled };
}
