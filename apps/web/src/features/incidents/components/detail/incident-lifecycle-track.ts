/**
 * PharosGRC — incident detail, pure derivation for the "Ciclo de vida" track
 * visual (018-incident-detail-experience, Fase 2+3).
 *
 * ## Deliberately NOT `risk-lifecycle-spine.ts`, generalized
 *
 * `features/risks/components/detail/risk-lifecycle-spine.ts` solves a
 * harder problem than this one: an 8-state graph with a fan-in/fan-out
 * around `UNDER_TREATMENT`, fed by `GET /risks/{riskId}/lifecycle` (a real
 * endpoint returning `availableTransitions` with server-evaluated
 * preconditions). `Incident` has none of that — four linear states plus one
 * terminal side-exit, and no lifecycle endpoint at all (see `status.ts`'s
 * own header comment: `availableIncidentTransitions` is a client-side
 * UI-only table, re-validated by the server on submit, never a mirror of a
 * fetched precondition result). Reusing the risk model would import a
 * vocabulary (`traversed`, `blocked`, branch geometry) that describes
 * exactly nothing about this domain, and CLAUDE.md §19.10 only credits a
 * promotion once a mechanism is genuinely exercised twice — this is a
 * different mechanism, not a second caller of that one. The user approved a
 * local, incident-specific lifecycle visual for this exact reason.
 *
 * ## The honesty constraint `IncidentDetail` forces (this is the point that
 * cannot slip)
 *
 * `IncidentDetail` carries NO history — no list of past transitions, no
 * "entered IN_PROGRESS at" timestamp. Only three facts prove a state was
 * ever reached:
 *
 *   - every incident is born `OPEN` (`data-model.md`), so reaching ANY other
 *     status — including `CANCELLED` — proves `OPEN` happened;
 *   - `resolvedAt` proves `RESOLVED` happened;
 *   - `closedAt` proves `CLOSED` happened.
 *
 * `IN_PROGRESS` has no equivalent field (no `startedAt`), so it is NEVER
 * marked `completed` — not even when the incident has since moved past it.
 * Marking it completed would also go stale the moment `RESOLVED ->
 * IN_PROGRESS` (reopen) fires: a "completed" badge on a state a reopened
 * incident might still return to would be an outright false claim, not
 * merely an optimistic one. `available` is read directly off
 * `availableIncidentTransitions(status)` — the same table
 * `IncidentLifecycleActions` renders buttons from — never recomputed
 * independently, so the track and the buttons can never disagree about
 * what is legal right now.
 *
 * `CANCELLED` is never a position ON the four-node main track — it is a
 * genuinely different terminal, reachable from two different origins
 * (`OPEN`/`IN_PROGRESS`) that this payload does not distinguish. It is
 * modelled as a separate, optional node, present ONLY when the incident's
 * CURRENT status actually is `CANCELLED` (`buildIncidentLifecycleTrack`'s
 * own `cancelled` field) — never drawn as a reachable position on an
 * incident that has not been cancelled, which would draw a destination
 * that, for this specific incident, may never exist.
 */
import type { IncidentTransitionOption } from '../../status';
import type { IncidentDetail, IncidentStatus } from '../../types';

export type IncidentLifecycleTrackState = 'current' | 'completed' | 'available' | 'unavailable';

export interface IncidentLifecycleTrackNode {
  readonly status: IncidentStatus;
  readonly state: IncidentLifecycleTrackState;
}

export interface IncidentLifecycleTrackModel {
  readonly main: readonly IncidentLifecycleTrackNode[];
  /** Present ONLY when `incident.status === 'CANCELLED'` — see this file's own header comment. */
  readonly cancelled: IncidentLifecycleTrackNode | null;
}

/** The four positions every incident's main track passes through, left to right. `CANCELLED` is never a member — see header comment. */
export const INCIDENT_LIFECYCLE_MAIN_TRACK: readonly IncidentStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

type TrackFacts = Pick<IncidentDetail, 'status' | 'resolvedAt' | 'closedAt'>;

/** Only these three facts can ever prove "completed" — see header comment for why `IN_PROGRESS` is permanently excluded. */
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

/** Resolves ONE main-track position's visual state — current, then provably completed, then available (a legal target right now), else unavailable. */
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

/**
 * Builds the track model — the four main-track nodes, plus the `CANCELLED`
 * node only when it is the incident's actual current status. Zero
 * additional requests: `availableTransitions` is the SAME
 * `availableIncidentTransitions(incident.status)` result the caller already
 * computed for the action buttons, passed in rather than recomputed here.
 */
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
