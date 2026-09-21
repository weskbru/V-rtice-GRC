/**
 * PharosGRC — risk detail, pure derivation for the lifecycle spine visual
 * (016-risk-detail-experience §4.6, R-1 to R-3, ADR-006).
 *
 * The mockup's five-step linear stepper does not exist in the real model
 * (R-1): the lifecycle is an 8-state graph with a fan-in/fan-out around
 * `UNDER_TREATMENT` (`apps/api/.../risk-lifecycle.ts`). This module derives,
 * from data `GET /risks/{riskId}/lifecycle` already sent — never a
 * re-implementation of the transition table itself (ADR-006) — which of the
 * spec's six main-spine positions and two branches are:
 *
 *   - `current` — the risk's actual `status`;
 *   - `traversed` — a member of `traversedStatuses` (F-CV-3), the set the
 *     SERVER derived from this risk's own append-only transition history
 *     (`GetRiskLifecycleUseCase`) — never inferred here from `status` alone;
 *   - `available` / `blocked` — read directly off `availableTransitions`,
 *     never recomputed;
 *   - `unavailable` — none of the above.
 *
 * ## F-CV-3 — the necessary-prefix inference this replaced
 *
 * Before `traversedStatuses` existed server-side, `isTraversed` guessed the
 * past from the present: a fixed DRAFT/IDENTIFIED/ASSESSED prefix rule, plus
 * one hand-written exception for CLOSED-when-ARCHIVED. It could not
 * represent "traversed AND not available now" for anything past ASSESSED —
 * `UNDER_TREATMENT` on an ARCHIVED risk rendered "Indisponível" with no way
 * to say the risk had, in fact, been there, because inference is a function
 * of `status` alone and archival erases what `status` alone can prove. Real
 * history has no such blind spot: it says what happened once and keeps
 * saying it, independent of what is reachable from here.
 *
 * Zero extra requests, zero false claims — exactly spec §4.6's own words,
 * now backed by data instead of an inferred prefix.
 */
import type { AvailableRiskTransition, RiskStatus } from '../../types';

export type RiskLifecycleSpineState =
  'current' | 'traversed' | 'available' | 'blocked' | 'unavailable';

export interface RiskLifecycleSpineNode {
  readonly status: RiskStatus;
  readonly state: RiskLifecycleSpineState;
  /** Only ever set when `state === 'blocked'` — already server-worded (FR-081), never re-derived here. */
  readonly unmetPreconditions?: readonly string[];
}

export interface RiskLifecycleSpineModel {
  readonly main: readonly RiskLifecycleSpineNode[];
  readonly branches: readonly RiskLifecycleSpineNode[];
}

/** The six positions every risk necessarily passes near, left to right — spec §4.6's own diagram. */
export const RISK_LIFECYCLE_MAIN_SPINE: readonly RiskStatus[] = [
  'DRAFT',
  'IDENTIFIED',
  'ASSESSED',
  'UNDER_TREATMENT',
  'CLOSED',
  'ARCHIVED',
];

/** The two branches off "Em tratamento" — never part of the traversed prefix. */
export const RISK_LIFECYCLE_BRANCHES: readonly RiskStatus[] = ['UNDER_REVIEW', 'ACCEPTED'];

/** Resolves ONE spine position's visual state — see this file's header comment for the rules. */
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

/** Builds the full spine model — main positions and branches — for the current lifecycle state.
 * `traversedStatuses` is the server-derived set (F-CV-3, `RiskLifecycleState.traversedStatuses`)
 * — never recomputed from `currentStatus` here. */
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
