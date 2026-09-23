import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { ActionStatus } from '@prisma/client';

const LEGAL_TRANSITIONS: Readonly<Record<ActionStatus, ReadonlySet<ActionStatus>>> = {
  OPEN: new Set<ActionStatus>(['IN_PROGRESS', 'CANCELLED']),
  IN_PROGRESS: new Set<ActionStatus>(['COMPLETED', 'CANCELLED']),
  COMPLETED: new Set<ActionStatus>(['OPEN']),
  CANCELLED: new Set<ActionStatus>(),
};

export function isLegalActionTransition(from: ActionStatus, to: ActionStatus): boolean {
  return LEGAL_TRANSITIONS[from].has(to);
}

export function assertLegalActionTransition(from: ActionStatus, to: ActionStatus): void {
  if (!isLegalActionTransition(from, to)) {
    throw new ValidationDomainError(USER_MESSAGES.action.transition.notAllowed, [
      { field: 'to', message: USER_MESSAGES.action.transition.notAllowed },
    ]);
  }
}

export function assertReopenReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.action.transition.reopenReasonRequired, [
      { field: 'reason', message: USER_MESSAGES.action.transition.reopenReasonRequired },
    ]);
  }
}

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
