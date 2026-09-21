/**
 * PharosGRC — control detail, pure derivation for the "Ciclo de vida" track
 * visual (021-control-detail-experience, Fase B).
 *
 * ## A local mechanism, not a generalization of Risk's/Problem's/Incident's/
 * Action's own
 *
 * Every sibling module's own `*-lifecycle-track.ts` solves the nearly
 * identical shape this file solves — but CLAUDE.md §19.10 credits a
 * promotion only once a mechanism is genuinely exercised by a second real
 * caller, not once it merely LOOKS reusable, and the coordinator's own
 * instruction for this phase was explicit: "não generalize as trilhas
 * existentes". `Control`'s own shape differs from every sibling's in two
 * ways that would make a shared abstraction leak: the main track is not a
 * strictly one-way progression (`ACTIVE <-> SUSPENDED` is bidirectional —
 * see `CONTROL_LIFECYCLE_TRANSITIONS` below), and completeness proof for one
 * of its three main-track positions (`ACTIVE`) comes from GRAPH REACHABILITY
 * over the transition table, not from a timestamp field the way every
 * sibling's own main-track completeness does.
 *
 * ## The honesty constraint `ControlDetail` forces (this is the point that
 * cannot slip)
 *
 * `ControlDetail` carries NO history — no list of past transitions (`GET
 * /controls/{controlId}/lifecycle` returns only `status` and
 * `availableTransitions`, confirmed by reading
 * `apps/api/src/modules/controls/application/lifecycle/
 * get-control-lifecycle.usecase.ts` and its own response mapper — neither
 * carries a transition log). Only two kinds of fact can ever prove a
 * position was reached:
 *
 *   1. **`DRAFT`** — every control is created with `status: 'DRAFT'`
 *      (`apps/api/prisma/schema.prisma`'s own `status ControlStatus
 *      @default(DRAFT)`, never overridden by
 *      `apps/api/src/modules/controls/application/create-control.usecase.ts`,
 *      which never sets `status` at all). So reaching ANY other status
 *      proves `DRAFT` happened — the same "born into the first state"
 *      reasoning every sibling's own track already relies on for its own
 *      first position.
 *
 *   2. **`ACTIVE`**, but ONLY when the control's CURRENT status is
 *      `SUSPENDED` — proven by reading
 *      `apps/api/src/modules/controls/domain/control-lifecycle.ts`'s
 *      `CONTROL_LIFECYCLE_TRANSITIONS` table directly: the table has exactly
 *      ONE row whose `to` is `'SUSPENDED'` (`{ from: 'ACTIVE', to:
 *      'SUSPENDED' }`) — there is no other way into `SUSPENDED` anywhere in
 *      the table. Being currently `SUSPENDED` therefore structurally proves
 *      `ACTIVE` was reached at least once. This is graph reachability over a
 *      FIXED table shape, evaluated once, here — it is NOT the mistake
 *      `specs/010-action-plan-surface` paid for (a track reading built from
 *      an intercepted capture that combined two fields the server can never
 *      actually write together): this reasoning depends on a single current
 *      field (`status`) plus a static table this file imports and reads
 *      directly, never on two independently-written stamps assumed to
 *      co-occur.
 *
 * Neither of those extends to `RETIRED` proving `ACTIVE`/`SUSPENDED`: the
 * table has THREE rows targeting `RETIRED` (`from: 'DRAFT' | 'ACTIVE' |
 * 'SUSPENDED'`), so a currently-`RETIRED` control could have skipped both —
 * `perform-control-transition.usecase.ts` confirms this directly: nothing in
 * the write path stamps which state a `RETIRED` control transitioned FROM,
 * only `retiredAt`/`retiredByUserId`/`retirementReason`, and only for the
 * transition INTO `RETIRED` itself. `SUSPENDED` is symmetrically
 * unprovable when the control is currently `ACTIVE` or `RETIRED`: no field
 * anywhere records "was ever suspended", and `ACTIVE` is reachable directly
 * from `DRAFT` without ever passing through `SUSPENDED`
 * (`{ from: 'DRAFT', to: 'ACTIVE' }`).
 *
 * `available` is read directly off the SAME `availableTransitions` the
 * caller already fetched once for the action buttons (`useControlLifecycle`,
 * `components/detail/`) — never recomputed independently, so the track and
 * the buttons can never disagree about what is legal right now, and no
 * second request is ever made to know it.
 *
 * `RETIRED` is never a position ON the three-node main track — like every
 * sibling's own detached terminal (`CANCELLED` for Problem/Incident/Action),
 * it is reachable from THREE different origins that this payload does not
 * distinguish (see above), so it is modelled as a separate, optional node,
 * present ONLY when the control's CURRENT status actually is `RETIRED` —
 * never drawn as a reachable position on a control that has not been
 * retired, and never visually tied to whichever main-track node it happens
 * to sit nearest.
 */
import type { AvailableControlTransition, ControlStatus } from '../../types';

export type ControlLifecycleTrackState = 'current' | 'completed' | 'available' | 'unavailable';

export interface ControlLifecycleTrackNode {
  readonly status: ControlStatus;
  readonly state: ControlLifecycleTrackState;
}

export interface ControlLifecycleTrackModel {
  readonly main: readonly ControlLifecycleTrackNode[];
  /** Present ONLY when `control.status === 'RETIRED'` — see this file's own header comment. */
  readonly retired: ControlLifecycleTrackNode | null;
}

/** The three positions every control's main track passes through, left to right. `RETIRED` is never a member — see header comment. */
export const CONTROL_LIFECYCLE_MAIN_TRACK: readonly ControlStatus[] = [
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
];

interface TrackFacts {
  readonly status: ControlStatus;
}

/**
 * Only these two kinds of proof can ever mark a main-track position
 * "completed" — see header comment. `SUSPENDED` is never provably completed:
 * no field records it, and both `ACTIVE` and `RETIRED` are reachable without
 * ever passing through it.
 */
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

/** Resolves ONE main-track position's visual state — current, then provably completed, then available (a legal target right now), else unavailable. */
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

/**
 * Builds the track model — the three main-track nodes, plus the `RETIRED`
 * node only when it is the control's actual current status. Zero additional
 * requests: `availableTransitions` is the SAME
 * `ControlLifecycleState.availableTransitions` the caller already fetched
 * once (`useControlLifecycle`) for the action buttons, passed in rather than
 * recomputed here.
 *
 * The server's `CONTROL_LIFECYCLE_TRANSITIONS` table
 * (`apps/api/src/modules/controls/domain/control-lifecycle.ts`) cannot be
 * imported here — `apps/web` and `apps/api` are separate packages/builds,
 * and importing backend domain source into the frontend would itself be
 * the kind of layering violation CLAUDE.md §2/§4 forbids. The single-
 * inbound-edge fact this file's `isProvablyCompleted('ACTIVE', …)` depends
 * on is therefore restated as a comment, cited above with its exact source
 * location, and independently guarded by this module's own test
 * (`control-lifecycle-track.test.ts`) so a change to the frontend's belief
 * about that table is at least self-consistent even though it cannot be
 * compile-time-linked to the server's own source.
 */
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
