/**
 * PharosGRC — problem detail, pure derivation for the "Ciclo de vida" track
 * visual (019-problem-detail-experience, Fase B).
 *
 * ## A local mechanism, not a generalization of Incident's or Risk's own
 *
 * `features/incidents/components/detail/incident-lifecycle-track.ts` solves
 * the nearly-identical four-state-plus-cancelled shape this file solves —
 * but CLAUDE.md §19.10 credits a promotion only once a mechanism is
 * genuinely exercised by a second real caller, not once it merely LOOKS
 * reusable, and the coordinator's own instruction for this phase was
 * explicit: "trilha local... deliberadamente NÃO generalizar". `Problem`'s
 * own vocabulary differs at exactly the position that would make a shared
 * abstraction leak: `IN_ANALYSIS` (not `IN_PROGRESS`), and `Problem` carries
 * no `resolutionSummary` equivalent (its own resolution fact, `rootCause`,
 * is not a lifecycle outcome at all — it gets its own first-class overview
 * card instead, see `problem-overview.tsx`). Two independently-authored
 * copies of eleven lines of state logic cost far less than a shared
 * abstraction parameterized over vocabulary that already diverges.
 *
 * ## The honesty constraint `ProblemDetail` forces (this is the point that
 * cannot slip)
 *
 * `ProblemDetail` carries NO history — no list of past transitions, no
 * "entered IN_ANALYSIS at" timestamp. Only three facts prove a state was
 * ever reached:
 *
 *   - every problem is born `OPEN` (data-model.md), so reaching ANY other
 *     status — including `CANCELLED` — proves `OPEN` happened;
 *   - `resolvedAt` proves `RESOLVED` happened;
 *   - `closedAt` proves `CLOSED` happened.
 *
 * `IN_ANALYSIS` has no equivalent field (no `analysisStartedAt`), so it is
 * NEVER marked `completed` — not even when the problem has since moved past
 * it. Marking it completed would also go stale the moment `RESOLVED ->
 * IN_ANALYSIS` (reopen) fires: a "completed" badge on a state a reopened
 * problem might still return to would be an outright false claim, not
 * merely an optimistic one. `available` is read directly off
 * `availableProblemTransitions(status)` — the SAME table
 * `ProblemLifecycleActions` renders buttons from — never recomputed
 * independently, so the track and the buttons can never disagree about what
 * is legal right now, and no second request is ever made to know it.
 *
 * `CANCELLED` is never a position ON the four-node main track — it is a
 * genuinely different terminal, reachable from two different origins
 * (`OPEN`/`IN_ANALYSIS`) that this payload does not distinguish. It is
 * modelled as a separate, optional node, present ONLY when the problem's
 * CURRENT status actually is `CANCELLED` (`buildProblemLifecycleTrack`'s own
 * `cancelled` field) — never drawn as a reachable position on a problem that
 * has not been cancelled, which would draw a destination that, for this
 * specific problem, may never exist.
 */
import type { ProblemTransitionOption } from '../../status';
import type { ProblemDetail, ProblemStatus } from '../../types';

export type ProblemLifecycleTrackState = 'current' | 'completed' | 'available' | 'unavailable';

export interface ProblemLifecycleTrackNode {
  readonly status: ProblemStatus;
  readonly state: ProblemLifecycleTrackState;
}

export interface ProblemLifecycleTrackModel {
  readonly main: readonly ProblemLifecycleTrackNode[];
  /** Present ONLY when `problem.status === 'CANCELLED'` — see this file's own header comment. */
  readonly cancelled: ProblemLifecycleTrackNode | null;
}

/** The four positions every problem's main track passes through, left to right. `CANCELLED` is never a member — see header comment. */
export const PROBLEM_LIFECYCLE_MAIN_TRACK: readonly ProblemStatus[] = [
  'OPEN',
  'IN_ANALYSIS',
  'RESOLVED',
  'CLOSED',
];

type TrackFacts = Pick<ProblemDetail, 'status' | 'resolvedAt' | 'closedAt'>;

/** Only these three facts can ever prove "completed" — see header comment for why `IN_ANALYSIS` is permanently excluded. */
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

/** Resolves ONE main-track position's visual state — current, then provably completed, then available (a legal target right now), else unavailable. */
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

/**
 * Builds the track model — the four main-track nodes, plus the `CANCELLED`
 * node only when it is the problem's actual current status. Zero additional
 * requests: `availableTransitions` is the SAME
 * `availableProblemTransitions(problem.status)` result the caller already
 * computed for the action buttons, passed in rather than recomputed here.
 */
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
