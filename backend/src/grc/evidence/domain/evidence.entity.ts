import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

export function assertEvidenceHasSubstance(input: {
  readonly externalUrl?: string | null | undefined;
  readonly observation?: string | null | undefined;
}): void {
  const hasExternalUrl = typeof input.externalUrl === 'string' && input.externalUrl.length > 0;
  const hasObservation = typeof input.observation === 'string' && input.observation.length > 0;

  if (!hasExternalUrl && !hasObservation) {
    throw new ValidationDomainError(USER_MESSAGES.evidence.hasSubstanceRequired, [
      { field: 'observation', message: USER_MESSAGES.evidence.hasSubstanceRequired },
    ]);
  }
}

export function assertValidUntilNotBeforeCollectedOn(
  collectedOn: Date,
  validUntil: Date | null | undefined,
): void {
  if (!validUntil) {
    return;
  }
  if (validUntil.getTime() < collectedOn.getTime()) {
    throw new ValidationDomainError(USER_MESSAGES.evidence.validUntilBeforeCollectedOn, [
      { field: 'validUntil', message: USER_MESSAGES.evidence.validUntilBeforeCollectedOn },
    ]);
  }
}

export function isEvidenceExpired(
  validUntil: Date | null | undefined,
  referenceDate: Date,
): boolean {
  if (!validUntil) {
    return false;
  }
  return validUntil.getTime() < referenceDate.getTime();
}

export function assertEvidenceEditable(status: 'ACTIVE' | 'ARCHIVED'): void {
  if (status === 'ARCHIVED') {
    throw new ValidationDomainError(USER_MESSAGES.evidence.archivedNotEditable, [
      { field: 'status', message: USER_MESSAGES.evidence.archivedNotEditable },
    ]);
  }
}

export function assertEvidenceLinkable(status: 'ACTIVE' | 'ARCHIVED'): void {
  if (status === 'ARCHIVED') {
    throw new ValidationDomainError(USER_MESSAGES.evidence.archivedNotLinkable, [
      { field: 'status', message: USER_MESSAGES.evidence.archivedNotLinkable },
    ]);
  }
}
