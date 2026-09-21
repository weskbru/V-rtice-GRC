/**
 * 008-incidents-problems, US2 — `Problem`'s domain invariants
 * (data-model.md §4: P1, P2, P3). Pure domain: no I/O, no framework import
 * (`eslint-plugin-boundaries` enforces this at `module-domain`).
 *
 * P2 and P3 both depend on a fact only a database query can answer
 * (whether a `COMPLETED` `Action` of origin `PROBLEM` exists for this
 * record, and who completed it) — `TransitionProblemUseCase` fetches that
 * list via `ProblemRepositoryPort.findCompletedOriginActionCompleters`
 * and hands it to the two assertions below; this file only APPLIES the
 * rule, it never queries for it (mirrors
 * `grc/finding/domain/finding.entity.ts#assertFindingCloseRequirementMet`/
 * `#assertCloserNotResponsibleForCompletedAction`'s identical split).
 */
import { ForbiddenDomainError, ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import { findProblemLifecycleTransition } from './problem-lifecycle';

import type { ProblemStatus } from '@prisma/client';

/** `data-model.md §4` transition table lookup — throws when `(from, to)`
 * is not a legal move. Mirrors
 * `modules/controls/domain/control-lifecycle.ts#findControlLifecycleTransition`'s
 * own "undefined means refuse" contract, applied here. */
export function assertLegalProblemTransition(from: ProblemStatus, to: ProblemStatus): void {
  if (!findProblemLifecycleTransition(from, to)) {
    throw new ValidationDomainError(USER_MESSAGES.problems.lifecycle.transitionNotAllowed, [
      { field: 'toStatus', message: USER_MESSAGES.problems.lifecycle.transitionNotAllowed },
    ]);
  }
}

/** **Invariant P1** (domain-enforced, data-model.md §4): `rootCause` is
 * `NOT NULL` the moment `status` becomes `RESOLVED`. */
export function assertRootCauseProvided(rootCause: string | null | undefined): void {
  if (!rootCause || rootCause.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.problems.transition.rootCauseRequired, [
      { field: 'rootCause', message: USER_MESSAGES.problems.transition.rootCauseRequired },
    ]);
  }
}

/** `TransitionProblemRequest.cancellationReason`'s `required` when
 * `toStatus: CANCELLED` — domain-enforced the same belt-and-suspenders way
 * `assertReopenReasonProvided` below and `Incident`'s own I2 are. */
export function assertCancellationReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.problems.transition.cancellationReasonRequired, [
      {
        field: 'cancellationReason',
        message: USER_MESSAGES.problems.transition.cancellationReasonRequired,
      },
    ]);
  }
}

/** `TransitionProblemRequest.reopenReason`'s `required` when reopening
 * (`RESOLVED -> IN_ANALYSIS`). `reason` is never a stored column on
 * `Problem` (data-model.md §1) — it reaches only the
 * `problem.reopened` audit event's `newValues`, mirroring
 * `Finding`/`Incident`'s identical convention. */
export function assertReopenReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.problems.transition.reopenReasonRequired, [
      { field: 'reopenReason', message: USER_MESSAGES.problems.transition.reopenReasonRequired },
    ]);
  }
}

/**
 * **Invariant P2** (domain-enforced, data-model.md §4): `status` may only
 * become `CLOSED` if at least one `Action` exists with
 * `originType = 'PROBLEM'`, `originId = <this problem>`,
 * `status = 'COMPLETED'`. `completerUserIds` is the caller-fetched result
 * of that query (`ProblemRepositoryPort
 * .findCompletedOriginActionCompleters`) — reverified on every attempt,
 * never cached (data-model.md §5's own "não armazenado" rule for this
 * exact fact).
 */
export function assertProblemHasCompletedCorrectiveAction(
  completerUserIds: readonly string[],
): void {
  if (completerUserIds.length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.problems.close.requirementNotMet, [
      { field: 'toStatus', message: USER_MESSAGES.problems.close.requirementNotMet },
    ]);
  }
}

/**
 * **Invariant P3 — segregation of duties** (domain-enforced,
 * data-model.md §4): the user closing the problem (`closerUserId`) must be
 * DIFFERENT from the `completedByUserId` of EVERY qualifying `Action`
 * (the same conservative "closer must not have completed even one of
 * them" reading `assertCloserNotResponsibleForCompletedAction` already
 * establishes for `Finding`'s F2 — see that function's own doc comment).
 * Checked with the SAME list P2 already fetched — one query answers both
 * invariants, never two round-trips that could disagree.
 */
export function assertCloserNotSameAsCompleter(
  closerUserId: string,
  completerUserIds: readonly string[],
): void {
  if (completerUserIds.includes(closerUserId)) {
    throw new ForbiddenDomainError(USER_MESSAGES.problems.close.segregationOfDuties);
  }
}
