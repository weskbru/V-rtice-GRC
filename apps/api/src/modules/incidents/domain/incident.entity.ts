import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { IncidentStatus } from '@prisma/client';

const LEGAL_TRANSITIONS: Readonly<Record<IncidentStatus, ReadonlySet<IncidentStatus>>> = {
  OPEN: new Set<IncidentStatus>(['IN_PROGRESS', 'CANCELLED']),
  IN_PROGRESS: new Set<IncidentStatus>(['RESOLVED', 'CANCELLED']),
  RESOLVED: new Set<IncidentStatus>(['CLOSED', 'IN_PROGRESS']),
  CLOSED: new Set<IncidentStatus>(),
  CANCELLED: new Set<IncidentStatus>(),
};

export const OPEN_INCIDENT_STATUSES: readonly IncidentStatus[] = (
  Object.keys(LEGAL_TRANSITIONS) as IncidentStatus[]
).filter((status) => LEGAL_TRANSITIONS[status].size > 0);

export function isLegalIncidentTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return LEGAL_TRANSITIONS[from].has(to);
}

export function assertLegalIncidentTransition(from: IncidentStatus, to: IncidentStatus): void {
  if (!isLegalIncidentTransition(from, to)) {
    throw new ValidationDomainError(USER_MESSAGES.incidents.transition.notAllowed, [
      { field: 'toStatus', message: USER_MESSAGES.incidents.transition.notAllowed },
    ]);
  }
}

export function assertResolutionSummaryProvided(summary: string | null | undefined): void {
  if (!summary || summary.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.incidents.transition.resolutionSummaryRequired, [
      {
        field: 'resolutionSummary',
        message: USER_MESSAGES.incidents.transition.resolutionSummaryRequired,
      },
    ]);
  }
}

export function assertCancellationReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.incidents.transition.cancellationReasonRequired, [
      {
        field: 'cancellationReason',
        message: USER_MESSAGES.incidents.transition.cancellationReasonRequired,
      },
    ]);
  }
}

export function assertReopenReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.incidents.transition.reopenReasonRequired, [
      { field: 'reopenReason', message: USER_MESSAGES.incidents.transition.reopenReasonRequired },
    ]);
  }
}

export function incidentTransitionEventName(
  from: IncidentStatus,
  to: IncidentStatus,
):
  | 'incident.started'
  | 'incident.resolved'
  | 'incident.cancelled'
  | 'incident.closed'
  | 'incident.reopened' {
  if (to === 'IN_PROGRESS') {
    return from === 'RESOLVED' ? 'incident.reopened' : 'incident.started';
  }
  switch (to) {
    case 'RESOLVED':
      return 'incident.resolved';
    case 'CANCELLED':
      return 'incident.cancelled';
    case 'CLOSED':
      return 'incident.closed';
    case 'OPEN':
      throw new ValidationDomainError(USER_MESSAGES.incidents.transition.notAllowed, [
        { field: 'toStatus', message: USER_MESSAGES.incidents.transition.notAllowed },
      ]);
  }
}
