/**
 * T030/003-controls-management, User Story 2 — unit coverage for
 * `domain/control-assessment-attestation.ts`: C1 (assessor), C2 (owner),
 * and both together (research.md D-3, FR-017/FR-018/FR-019).
 */
import { describe, expect, it } from 'vitest';

import {
  assertAttestationSegregation,
  attestationSegregationMessage,
  checkAttestationSegregation,
} from '../../src/modules/controls/domain/control-assessment-attestation';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';

const ASSESSOR = 'user-assessor';
const OWNER = 'user-owner';
const THIRD_PARTY = 'user-third-party';

describe('checkAttestationSegregation (D-3, C1/C2)', () => {
  it('returns no violation for a third party who is neither the assessor nor the owner', () => {
    expect(
      checkAttestationSegregation({
        assessorUserId: ASSESSOR,
        controlOwnerUserId: OWNER,
        attesterUserId: THIRD_PARTY,
      }),
    ).toEqual([]);
  });

  it('C1 — the assessor attesting their own assessment is flagged, and ONLY C1', () => {
    const violations = checkAttestationSegregation({
      assessorUserId: ASSESSOR,
      controlOwnerUserId: OWNER,
      attesterUserId: ASSESSOR,
    });
    expect(violations).toEqual(['ASSESSOR']);
  });

  it("C2 — the control's owner attesting is flagged, and ONLY C2", () => {
    const violations = checkAttestationSegregation({
      assessorUserId: ASSESSOR,
      controlOwnerUserId: OWNER,
      attesterUserId: OWNER,
    });
    expect(violations).toEqual(['OWNER']);
  });

  it('C1 AND C2 together — the same person is both assessor and owner: BOTH are named', () => {
    const violations = checkAttestationSegregation({
      assessorUserId: ASSESSOR,
      controlOwnerUserId: ASSESSOR,
      attesterUserId: ASSESSOR,
    });
    expect(violations).toEqual(['ASSESSOR', 'OWNER']);
  });

  it('an owner-less control (legacy/DRAFT) never triggers C2', () => {
    const violations = checkAttestationSegregation({
      assessorUserId: ASSESSOR,
      controlOwnerUserId: undefined,
      attesterUserId: THIRD_PARTY,
    });
    expect(violations).toEqual([]);
  });
});

describe('attestationSegregationMessage — distinct wording per violation set', () => {
  it('C1 alone uses the assessor-specific message', () => {
    expect(attestationSegregationMessage(['ASSESSOR'])).toBe(
      USER_MESSAGES.controls.assessment.attestation.segregationAssessor,
    );
  });

  it('C2 alone uses the owner-specific message', () => {
    expect(attestationSegregationMessage(['OWNER'])).toBe(
      USER_MESSAGES.controls.assessment.attestation.segregationOwner,
    );
  });

  it('both together use the combined message — never a generic merge', () => {
    const combined = attestationSegregationMessage(['ASSESSOR', 'OWNER']);
    expect(combined).toBe(USER_MESSAGES.controls.assessment.attestation.segregationBoth);
    expect(combined).not.toBe(USER_MESSAGES.controls.assessment.attestation.segregationAssessor);
    expect(combined).not.toBe(USER_MESSAGES.controls.assessment.attestation.segregationOwner);
  });
});

describe('assertAttestationSegregation', () => {
  it('throws ValidationDomainError (422-mapped) on any violation', () => {
    expect(() =>
      assertAttestationSegregation({
        assessorUserId: ASSESSOR,
        controlOwnerUserId: OWNER,
        attesterUserId: ASSESSOR,
      }),
    ).toThrow(ValidationDomainError);
  });

  it('does not throw for a legitimate third-party attester', () => {
    expect(() =>
      assertAttestationSegregation({
        assessorUserId: ASSESSOR,
        controlOwnerUserId: OWNER,
        attesterUserId: THIRD_PARTY,
      }),
    ).not.toThrow();
  });
});
