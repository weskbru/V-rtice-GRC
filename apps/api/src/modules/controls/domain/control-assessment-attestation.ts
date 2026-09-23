import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

export type AttestationSegregationViolation = 'ASSESSOR' | 'OWNER';

export interface AttestationSegregationInput {
  readonly assessorUserId: string;
  readonly controlOwnerUserId: string | undefined;
  readonly attesterUserId: string;
}

export function checkAttestationSegregation(
  input: AttestationSegregationInput,
): readonly AttestationSegregationViolation[] {
  const violations: AttestationSegregationViolation[] = [];

  if (input.attesterUserId === input.assessorUserId) {
    violations.push('ASSESSOR');
  }
  if (input.controlOwnerUserId !== undefined && input.attesterUserId === input.controlOwnerUserId) {
    violations.push('OWNER');
  }

  return violations;
}

function messageForViolation(violation: AttestationSegregationViolation): string {
  return violation === 'ASSESSOR'
    ? USER_MESSAGES.controls.assessment.attestation.segregationAssessor
    : USER_MESSAGES.controls.assessment.attestation.segregationOwner;
}

export function attestationSegregationMessage(
  violations: readonly AttestationSegregationViolation[],
): string {
  if (violations.length >= 2) {
    return USER_MESSAGES.controls.assessment.attestation.segregationBoth;
  }
  return messageForViolation(violations[0]!);
}

export function assertAttestationSegregation(input: AttestationSegregationInput): void {
  const violations = checkAttestationSegregation(input);
  if (violations.length === 0) {
    return;
  }
  const message = attestationSegregationMessage(violations);
  throw new ValidationDomainError(message, [{ field: 'decision', message }]);
}
