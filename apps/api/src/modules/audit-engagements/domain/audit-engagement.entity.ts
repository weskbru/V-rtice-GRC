import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { AuditEngagementStatus } from '@prisma/client';

const LEGAL_TRANSITIONS: Readonly<
  Record<AuditEngagementStatus, ReadonlySet<AuditEngagementStatus>>
> = {
  PLANNING: new Set<AuditEngagementStatus>(['IN_PROGRESS', 'CANCELLED']),
  IN_PROGRESS: new Set<AuditEngagementStatus>(['COMPLETED', 'CANCELLED']),
  COMPLETED: new Set<AuditEngagementStatus>(),
  CANCELLED: new Set<AuditEngagementStatus>(),
};

export const OPEN_AUDIT_ENGAGEMENT_STATUSES: readonly AuditEngagementStatus[] = (
  Object.keys(LEGAL_TRANSITIONS) as AuditEngagementStatus[]
).filter((status) => LEGAL_TRANSITIONS[status].size > 0);

export function isLegalAuditEngagementTransition(
  from: AuditEngagementStatus,
  to: AuditEngagementStatus,
): boolean {
  return LEGAL_TRANSITIONS[from].has(to);
}

export function assertLegalAuditEngagementTransition(
  from: AuditEngagementStatus,
  to: AuditEngagementStatus,
): void {
  if (!isLegalAuditEngagementTransition(from, to)) {
    throw new ValidationDomainError(USER_MESSAGES.auditEngagements.lifecycle.transitionNotAllowed, [
      { field: 'status', message: USER_MESSAGES.auditEngagements.lifecycle.transitionNotAllowed },
    ]);
  }
}

export function isAuditEngagementEditable(status: AuditEngagementStatus): boolean {
  return status === 'PLANNING';
}

export function assertAuditEngagementEditable(status: AuditEngagementStatus): void {
  if (!isAuditEngagementEditable(status)) {
    throw new ValidationDomainError(
      USER_MESSAGES.auditEngagements.lifecycle.editableOnlyWhilePlanning,
      [
        {
          field: 'status',
          message: USER_MESSAGES.auditEngagements.lifecycle.editableOnlyWhilePlanning,
        },
      ],
    );
  }
}

export function assertAuditEngagementHasScope(scopeLinkCount: number): void {
  if (scopeLinkCount <= 0) {
    throw new ValidationDomainError(USER_MESSAGES.auditEngagements.lifecycle.startRequiresScope, [
      { field: 'status', message: USER_MESSAGES.auditEngagements.lifecycle.startRequiresScope },
    ]);
  }
}

export function assertAuditEngagementAcceptsFindings(status: AuditEngagementStatus): void {
  if (status !== 'IN_PROGRESS') {
    throw new ValidationDomainError(
      USER_MESSAGES.auditEngagements.lifecycle.findingsRequireInProgress,
      [
        {
          field: 'status',
          message: USER_MESSAGES.auditEngagements.lifecycle.findingsRequireInProgress,
        },
      ],
    );
  }
}

export function assertCancellationJustificationProvided(
  justification: string | null | undefined,
): void {
  if (!justification || justification.trim().length === 0) {
    throw new ValidationDomainError(
      USER_MESSAGES.auditEngagements.lifecycle.cancellationJustificationRequired,
      [
        {
          field: 'justification',
          message: USER_MESSAGES.auditEngagements.lifecycle.cancellationJustificationRequired,
        },
      ],
    );
  }
}

export function assertPeriodEndNotBeforeStart(periodStart: Date, periodEnd: Date): void {
  if (periodEnd.getTime() < periodStart.getTime()) {
    throw new ValidationDomainError(USER_MESSAGES.auditEngagements.periodEndBeforeStart, [
      { field: 'periodEnd', message: USER_MESSAGES.auditEngagements.periodEndBeforeStart },
    ]);
  }
}
