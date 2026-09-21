/**
 * T047/002-shared-grc-foundation, US2 — `Action`'s domain invariants and
 * lifecycle transition table (data-model.md §4, FR-011 to FR-016). Pure
 * domain logic, matching `evidence.entity.ts`'s own shape — see that file's
 * header for why throwing `shared/errors/domain-error.ts` types directly
 * from here is not a boundary violation.
 *
 * `Action` itself has no mutable-aggregate class in this codebase's style —
 * like `Evidence`/`Risk`, the wire-shape record lives in the repository
 * port (`ActionRecord`, `domain/ports/action-repository.port.ts`) and this
 * file owns the INVARIANTS and the TRANSITION TABLE a use case must apply
 * before writing one.
 *
 * ## The transition table (data-model.md §4's diagram, transcribed exactly)
 *
 * ```
 * OPEN ──> IN_PROGRESS ──> COMPLETED
 *   │            │              │
 *   │            │              └──> OPEN            (reabertura, exige motivo)
 *   └────────────┴──────────────────> CANCELLED
 * ```
 *
 * Five legal edges, no more: `OPEN->IN_PROGRESS`, `IN_PROGRESS->COMPLETED`,
 * `COMPLETED->OPEN`, `OPEN->CANCELLED`, `IN_PROGRESS->CANCELLED`.
 * `CANCELLED` is terminal (data-model.md §4: "CANCELLED é terminal").
 * `OPEN->COMPLETED` directly (skipping `IN_PROGRESS`) is deliberately NOT
 * in this table, even though nothing in FR-011-FR-019 explicitly forbids
 * it — the diagram is the one place data-model.md draws the shape, and an
 * action's completion should always pass through "someone is actively
 * working it" rather than jumping straight from "not started" to "done".
 * `TransitionActionUseCase` (T052) is the ONLY caller of
 * {@link assertLegalActionTransition}; `grc/action`'s convergence write for
 * `RISK_TREATMENT` (T055/R-003) deliberately does NOT call it — see that
 * use case's own header for why the mirror write must stay permissive.
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { ActionStatus } from '@prisma/client';

/** Every legal `(from, to)` pair, keyed by `from` for O(1) lookup. */
const LEGAL_TRANSITIONS: Readonly<Record<ActionStatus, ReadonlySet<ActionStatus>>> = {
  OPEN: new Set<ActionStatus>(['IN_PROGRESS', 'CANCELLED']),
  IN_PROGRESS: new Set<ActionStatus>(['COMPLETED', 'CANCELLED']),
  COMPLETED: new Set<ActionStatus>(['OPEN']),
  CANCELLED: new Set<ActionStatus>(),
};

/** True when `from -> to` is one of the five edges in the table above. */
export function isLegalActionTransition(from: ActionStatus, to: ActionStatus): boolean {
  return LEGAL_TRANSITIONS[from].has(to);
}

/**
 * Throws `ValidationDomainError` (422) for any `(from, to)` pair not in the
 * table — `TransitionActionUseCase`'s own gate (FR-011-FR-016). A same-state
 * "transition" (`from === to`) is also illegal: it is not one of the five
 * named edges, and would otherwise silently fire a semantic event
 * (`action.started`, say) for a caller who changed nothing.
 */
export function assertLegalActionTransition(from: ActionStatus, to: ActionStatus): void {
  if (!isLegalActionTransition(from, to)) {
    throw new ValidationDomainError(USER_MESSAGES.action.transition.notAllowed, [
      { field: 'to', message: USER_MESSAGES.action.transition.notAllowed },
    ]);
  }
}

/**
 * **Invariant A2** (domain-enforced, data-model.md §4): reopening
 * (`COMPLETED -> OPEN`) requires a non-empty `reason`. Called only when
 * `to === 'OPEN'` — `TransitionActionUseCase` is the only caller.
 */
export function assertReopenReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.action.transition.reopenReasonRequired, [
      { field: 'reason', message: USER_MESSAGES.action.transition.reopenReasonRequired },
    ]);
  }
}

/**
 * Maps a transition's target status to the ONE semantic audit event name
 * that transition fires (FR-028: never a generic `action.updated` standing
 * in for a lifecycle change). Because `ActionStatus` has exactly four
 * members and `OPEN` is reachable as a transition target only via
 * `COMPLETED -> OPEN` (the table above has no other edge INTO `OPEN`),
 * every legal target status names exactly one event — there is no
 * ambiguous or "generic" case to fall back to.
 */
export function actionTransitionEventName(
  to: ActionStatus,
): 'action.started' | 'action.completed' | 'action.cancelled' | 'action.reopened' {
  switch (to) {
    case 'IN_PROGRESS':
      return 'action.started';
    case 'COMPLETED':
      return 'action.completed';
    case 'CANCELLED':
      return 'action.cancelled';
    case 'OPEN':
      return 'action.reopened';
  }
}
