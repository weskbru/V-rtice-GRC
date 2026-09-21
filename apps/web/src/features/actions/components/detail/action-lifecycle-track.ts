/**
 * PharosGRC — action detail, pure derivation for the "Ciclo de vida" track
 * visual (020-action-detail-experience, Fase B).
 *
 * ## A local mechanism, not a generalization of Incident's or Problem's own
 *
 * `features/incidents/components/detail/incident-lifecycle-track.ts` and
 * `features/problems/components/detail/problem-lifecycle-track.ts` each
 * solve the nearly-identical shape this file solves — but CLAUDE.md §19.10
 * credits a promotion only once a mechanism is genuinely exercised by a
 * second real caller, not once it merely LOOKS reusable, and the
 * coordinator's own instruction for this phase was explicit: "não
 * generalize as trilhas existentes". `Action`'s own vocabulary differs at
 * the exact position that would make a shared abstraction leak: a
 * three-position main track (`OPEN` → `IN_PROGRESS` → `COMPLETED`), one
 * shorter than Incident's/Problem's own four, and `Action` carries
 * `completedAt`/`reopenedAt` — a genuinely different pair of outcome facts
 * from either sibling's `resolvedAt`/`closedAt`. Three independently
 * authored, short copies of this logic cost far less than a shared
 * abstraction parameterized over a shape that already diverges twice.
 *
 * ## The honesty constraint `Action` forces (this is the point that cannot
 * slip)
 *
 * `Action` carries NO history — no list of past transitions, no "entered
 * IN_PROGRESS at" timestamp. Only two facts prove a state was ever reached:
 *
 *   - every action is born `OPEN` (`ActionEntity`'s own invariant), so
 *     reaching ANY other status — including `CANCELLED` — proves `OPEN`
 *     happened;
 *   - `completedAt` proves `COMPLETED` happened.
 *
 * `IN_PROGRESS` has no equivalent field (no `startedAt`), so it is NEVER
 * marked `completed` — not even once the action has moved well past it.
 * `available` is read directly off `availableTransitions(status)` — the
 * SAME `ACTION_TRANSITIONS` table `ActionLifecycleActions` renders buttons
 * from, never recomputed independently, so the track and the buttons can
 * never disagree about what is legal right now, and no second request is
 * ever made to know it.
 *
 * ## The reopened case — CORRECTED 2026-09-18, against the real server, not
 * an intercepted guess
 *
 * This file originally reasoned about a `status: 'OPEN'` node with BOTH
 * `completedAt` AND `reopenedAt` present, on the claim that "`completedAt`
 * is never cleared by the reopen transition". That claim was wrong, and was
 * only caught by running `action-plan.spec.ts`'s Fase D E2E test against
 * the REAL API end to end — a rendered check the coordinator's own earlier
 * approval of this reasoning had done by INTERCEPTING the API response
 * (`docs/deferred-findings.md`'s own discipline: an intercepted state is
 * evidence about the FRONTEND, never about what the backend actually
 * produces). Reading `TransitionActionUseCase#execute`
 * (`apps/api/src/grc/action/application/transition-action.usecase.ts`)
 * directly settles it: EVERY transition call stamps BOTH completion columns
 * unconditionally from `input.to` alone —
 * `completedAt: input.to === 'COMPLETED' ? now : null` and `reopenedAt:
 * input.to === 'OPEN' ? now : null` — with no branch that preserves a prior
 * value. Since `OPEN` is reachable ONLY via `COMPLETED -> OPEN`
 * (`action.entity.ts`'s own transition table — reopening is the one and
 * only edge INTO `OPEN`), and no other write path touches either column
 * (confirmed: `create-action.usecase.ts` never sets either past their
 * initial `null`, and the risk-treatment convergence write delegates
 * status changes to this SAME use case rather than stamping its own
 * copies) — `completedAt` and `reopenedAt` can NEVER be simultaneously
 * non-null on a live `Action` row, under any transition sequence. The
 * scenario this section used to build a whole honesty argument around does
 * not exist in this product.
 *
 * ## What a reopened action's track actually shows
 *
 * Immediately after `COMPLETED -> OPEN`: `status: 'OPEN'`, `completedAt:
 * null` (cleared), `reopenedAt` real. The track therefore reads EXACTLY
 * like a fresh action that never completed — `OPEN` current, `IN_PROGRESS`
 * available, `COMPLETED` unavailable — because `isProvablyCompleted
 * ('COMPLETED', …)` trusts only the LIVE `completedAt` value, and it is
 * genuinely `null` now. This is still the honest reading, and a simpler one
 * than the rejected alternative below: the overview never claims completion
 * happened, because the live record no longer proves it — the fact is not
 * lost, it moves to where a HISTORICAL fact belongs, the audit trail's own
 * `previousValues` on the reopen event ("Auditoria", a different section),
 * never silently re-asserted on the current-state card. The only visible
 * trace of the reopen on THIS card is `reopenedAt` itself — "Reaberta em"
 * renders in `ActionLifecycleSection`'s own outcome facts; "Concluída em"
 * does not, because it is no longer true.
 *
 * No code in `isProvablyCompleted`/`resolveMainTrackNode` below needed to
 * change for this correction — the function already trusts only the
 * CURRENT value of each field, never infers "provably completed" from
 * status history that is not actually recorded. The correction was entirely
 * to this comment's claim about server behaviour, and to the test/E2E
 * scenarios that had been built to match the wrong claim
 * (`action-lifecycle-track.test.ts`, `action-lifecycle-section.test.tsx`,
 * `action-plan.spec.ts`).
 *
 * `CANCELLED` is never a position ON the three-node main track — it is a
 * genuinely different terminal, reachable from two different origins
 * (`OPEN`/`IN_PROGRESS`) that this payload does not distinguish. It is
 * modelled as a separate, optional node, present ONLY when the action's
 * CURRENT status actually is `CANCELLED` (`buildActionLifecycleTrack`'s own
 * `cancelled` field) — never drawn as a reachable position on an action
 * that has not been cancelled, which would draw a destination that, for
 * this specific action, may never exist.
 */
import type { ActionTransitionOption } from '../../status';
import type { Action, ActionStatus } from '../../types';

export type ActionLifecycleTrackState = 'current' | 'completed' | 'available' | 'unavailable';

export interface ActionLifecycleTrackNode {
  readonly status: ActionStatus;
  readonly state: ActionLifecycleTrackState;
}

export interface ActionLifecycleTrackModel {
  readonly main: readonly ActionLifecycleTrackNode[];
  /** Present ONLY when `action.status === 'CANCELLED'` — see this file's own header comment. */
  readonly cancelled: ActionLifecycleTrackNode | null;
}

/** The three positions every action's main track passes through, left to right. `CANCELLED` is never a member — see header comment. */
export const ACTION_LIFECYCLE_MAIN_TRACK: readonly ActionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
];

type TrackFacts = Pick<Action, 'status' | 'completedAt'>;

/** Only these two facts can ever prove "completed" — see header comment for why `IN_PROGRESS` is permanently excluded, and for the reopened-action reading of `COMPLETED`. */
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

/** Resolves ONE main-track position's visual state — current, then provably completed, then available (a legal target right now), else unavailable. */
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

/**
 * Builds the track model — the three main-track nodes, plus the `CANCELLED`
 * node only when it is the action's actual current status. Zero additional
 * requests: `availableTransitions` is the SAME `availableTransitions(action
 * .status)` result the caller already computed for the action buttons,
 * passed in rather than recomputed here.
 */
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
