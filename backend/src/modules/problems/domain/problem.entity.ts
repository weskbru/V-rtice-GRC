import { ForbiddenDomainError, ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import { findProblemLifecycleTransition } from './problem-lifecycle';

import type { ProblemStatus } from '@prisma/client';

export function assertLegalProblemTransition(from: ProblemStatus, to: ProblemStatus): void {
  if (!findProblemLifecycleTransition(from, to)) {
    throw new ValidationDomainError(USER_MESSAGES.problems.lifecycle.transitionNotAllowed, [
      { field: 'toStatus', message: USER_MESSAGES.problems.lifecycle.transitionNotAllowed },
    ]);
  }
}

export function assertRootCauseProvided(rootCause: string | null | undefined): void {
  if (!rootCause || rootCause.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.problems.transition.rootCauseRequired, [
      { field: 'rootCause', message: USER_MESSAGES.problems.transition.rootCauseRequired },
    ]);
  }
}

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

export function assertReopenReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.problems.transition.reopenReasonRequired, [
      { field: 'reopenReason', message: USER_MESSAGES.problems.transition.reopenReasonRequired },
    ]);
  }
}

export function assertProblemHasCompletedCorrectiveAction(
  completerUserIds: readonly string[],
): void {
  if (completerUserIds.length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.problems.close.requirementNotMet, [
      { field: 'toStatus', message: USER_MESSAGES.problems.close.requirementNotMet },
    ]);
  }
}

export function assertCloserNotSameAsCompleter(
  closerUserId: string,
  completerUserIds: readonly string[],
): void {
  if (completerUserIds.includes(closerUserId)) {
    throw new ForbiddenDomainError(USER_MESSAGES.problems.close.segregationOfDuties);
  }
}
