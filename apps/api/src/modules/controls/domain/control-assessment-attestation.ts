/**
 * T030/003-controls-management, User Story 2 — the two independent
 * segregation-of-duties invariants governing who may attest a
 * `ControlAssessment` (data-model.md §4, research.md D-3, FR-017/FR-018).
 * Pure domain: no I/O, no framework import. Mirrors
 * `modules/risk/domain/approval.ts#assertApproverDiffersFromRequester`'s
 * shape, but declared as TWO separate, independently-testable checks
 * rather than one merged rule — see this file's own `checkAttestationSegregation`
 * for why.
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

/** Which invariant(s) a candidate attester violates — a closed union so a
 * caller (the audit trail, FR-019) can name each violated rule explicitly
 * rather than working backwards from a single merged message string. */
export type AttestationSegregationViolation = 'ASSESSOR' | 'OWNER';

export interface AttestationSegregationInput {
  readonly assessorUserId: string;
  /** `undefined` for a legacy control with no owner assigned yet — such a
   * control cannot have entered `ACTIVE` (FR-005), so in practice this is
   * never `undefined` at attestation time; kept optional here so this
   * function's signature does not silently assume a precondition another
   * layer is responsible for. */
  readonly controlOwnerUserId: string | undefined;
  readonly attesterUserId: string;
}

/**
 * Evaluates BOTH invariants independently and returns every one the
 * candidate attester violates (data-model.md §4: "Duas invariantes,
 * verificadas no domínio e independentemente testáveis"):
 *
 * - **C1** — `attesterUserId === assessorUserId` (FR-017): the person who
 *   executed the verification may not attest it.
 * - **C2** — `attesterUserId === controlOwnerUserId` (FR-018): the
 *   control's owner may not attest verifications of their own control.
 *
 * Returns an empty array when neither applies. When BOTH apply — the same
 * person accumulates both roles — both are returned, never collapsed into
 * one (edge case "atestação por quem acumula papéis"; FR-019: "o evento
 * nomeia as duas").
 */
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

/** pt-BR message for a single violated rule — used only when exactly one
 * of the two applies; `attestationSegregationMessage` below picks the
 * combined message when both do. */
function messageForViolation(violation: AttestationSegregationViolation): string {
  return violation === 'ASSESSOR'
    ? USER_MESSAGES.controls.assessment.attestation.segregationAssessor
    : USER_MESSAGES.controls.assessment.attestation.segregationOwner;
}

/** The pt-BR message for `violations`, chosen by count — never a
 * concatenation the caller has to build itself, so every call site reports
 * the identical wording for the identical violation set. */
export function attestationSegregationMessage(
  violations: readonly AttestationSegregationViolation[],
): string {
  if (violations.length >= 2) {
    return USER_MESSAGES.controls.assessment.attestation.segregationBoth;
  }
  return messageForViolation(violations[0]!);
}

/**
 * Throws {@link ValidationDomainError} (422) when `checkAttestationSegregation`
 * returns one or more violations; a no-op otherwise. Callers that also need
 * to AUDIT the refused attempt (FR-019, `DecideControlAssessmentAttestationUseCase`)
 * should call `checkAttestationSegregation` themselves first, record the
 * audit entry naming every violated rule, and only then call this — never
 * the other way around, since this function throws and never returns once
 * a violation exists.
 */
export function assertAttestationSegregation(input: AttestationSegregationInput): void {
  const violations = checkAttestationSegregation(input);
  if (violations.length === 0) {
    return;
  }
  const message = attestationSegregationMessage(violations);
  throw new ValidationDomainError(message, [{ field: 'decision', message }]);
}
