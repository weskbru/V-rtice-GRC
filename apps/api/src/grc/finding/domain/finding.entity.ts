import { ForbiddenDomainError, ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { FindingStatus } from '@prisma/client';

const LEGAL_TRANSITIONS: Readonly<Record<FindingStatus, ReadonlySet<FindingStatus>>> = {
  OPEN: new Set<FindingStatus>(['IN_REMEDIATION', 'CLOSED']),
  IN_REMEDIATION: new Set<FindingStatus>(['CLOSED']),
  CLOSED: new Set<FindingStatus>(['ARCHIVED', 'IN_REMEDIATION']),
  ARCHIVED: new Set<FindingStatus>(),
};

export const OPEN_FINDING_STATUSES: readonly FindingStatus[] = ['OPEN', 'IN_REMEDIATION'];

export function isLegalFindingTransition(from: FindingStatus, to: FindingStatus): boolean {
  return LEGAL_TRANSITIONS[from].has(to);
}

export function assertLegalFindingTransition(from: FindingStatus, to: FindingStatus): void {
  if (!isLegalFindingTransition(from, to)) {
    throw new ValidationDomainError(USER_MESSAGES.findings.transition.notAllowed, [
      { field: 'status', message: USER_MESSAGES.findings.transition.notAllowed },
    ]);
  }
}

export function assertFindingCloseRequirementMet(
  hasCompletedLinkedAction: boolean,
  justification: string | null | undefined,
): void {
  const hasJustification = typeof justification === 'string' && justification.trim().length > 0;
  if (!hasCompletedLinkedAction && !hasJustification) {
    throw new ValidationDomainError(USER_MESSAGES.findings.close.requirementNotMet, [
      { field: 'justification', message: USER_MESSAGES.findings.close.requirementNotMet },
    ]);
  }
}

export function assertFindingHasSupportingEvidence(hasActiveEvidenceLink: boolean): void {
  if (!hasActiveEvidenceLink) {
    throw new ValidationDomainError(USER_MESSAGES.findings.close.evidenceRequired, [
      { field: 'evidence', message: USER_MESSAGES.findings.close.evidenceRequired },
    ]);
  }
}

export function assertCloserNotResponsibleForCompletedAction(
  closerUserId: string,
  completedActionResponsibleUserIds: readonly string[],
): void {
  if (completedActionResponsibleUserIds.includes(closerUserId)) {
    throw new ForbiddenDomainError(USER_MESSAGES.findings.close.segregationOfDuties);
  }
}

export function assertReopenReasonProvided(reason: string | null | undefined): void {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.findings.reopen.reasonRequired, [
      { field: 'reason', message: USER_MESSAGES.findings.reopen.reasonRequired },
    ]);
  }
}

export function assertFindingCanBeReopened(status: FindingStatus): void {
  if (status !== 'CLOSED') {
    throw new ValidationDomainError(USER_MESSAGES.findings.transition.notAllowed, [
      { field: 'status', message: USER_MESSAGES.findings.transition.notAllowed },
    ]);
  }
}

export const INVARIANT_F3_NOTE =
  'Completing every linked Action never closes a Finding — see this constant’s own doc comment.';

export function assertFindingEditable(status: FindingStatus): void {
  if (status === 'ARCHIVED') {
    throw new ValidationDomainError(USER_MESSAGES.findings.archivedNotEditable, [
      { field: 'status', message: USER_MESSAGES.findings.archivedNotEditable },
    ]);
  }
}
