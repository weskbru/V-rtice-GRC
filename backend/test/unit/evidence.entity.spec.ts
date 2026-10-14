import { describe, expect, it } from 'vitest';

import {
  assertEvidenceEditable,
  assertEvidenceHasSubstance,
  assertEvidenceLinkable,
  assertValidUntilNotBeforeCollectedOn,
  isEvidenceExpired,
} from '../../src/grc/evidence/domain/evidence.entity';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';

describe('assertEvidenceHasSubstance (Invariant E1, FR-002)', () => {
  it('rejects evidence with neither externalUrl nor observation', () => {
    expect(() => assertEvidenceHasSubstance({})).toThrow(ValidationDomainError);
  });

  it('rejects evidence with only empty-string externalUrl/observation', () => {
    expect(() => assertEvidenceHasSubstance({ externalUrl: '', observation: '' })).toThrow(
      ValidationDomainError,
    );
  });

  it('accepts evidence with only externalUrl', () => {
    expect(() =>
      assertEvidenceHasSubstance({ externalUrl: 'https://example.org/report.pdf' }),
    ).not.toThrow();
  });

  it('accepts evidence with only observation', () => {
    expect(() => assertEvidenceHasSubstance({ observation: 'Texto da observação.' })).not.toThrow();
  });

  it('accepts evidence with both externalUrl and observation', () => {
    expect(() =>
      assertEvidenceHasSubstance({
        externalUrl: 'https://example.org/report.pdf',
        observation: 'Relatório de teste de intrusão cobrindo a API administrativa.',
      }),
    ).not.toThrow();
  });
});

describe('assertValidUntilNotBeforeCollectedOn (Invariant E2)', () => {
  const collectedOn = new Date(Date.UTC(2026, 2, 15));

  it('accepts a missing validUntil', () => {
    expect(() => assertValidUntilNotBeforeCollectedOn(collectedOn, undefined)).not.toThrow();
  });

  it('accepts validUntil equal to collectedOn', () => {
    expect(() => assertValidUntilNotBeforeCollectedOn(collectedOn, collectedOn)).not.toThrow();
  });

  it('accepts validUntil after collectedOn', () => {
    const validUntil = new Date(Date.UTC(2026, 5, 15));
    expect(() => assertValidUntilNotBeforeCollectedOn(collectedOn, validUntil)).not.toThrow();
  });

  it('rejects validUntil before collectedOn', () => {
    const validUntil = new Date(Date.UTC(2026, 0, 1));
    expect(() => assertValidUntilNotBeforeCollectedOn(collectedOn, validUntil)).toThrow(
      ValidationDomainError,
    );
  });
});

describe('isEvidenceExpired (data-model.md §6 — derived, never stored)', () => {
  const today = new Date(Date.UTC(2026, 5, 15));

  it('is false when validUntil is absent', () => {
    expect(isEvidenceExpired(undefined, today)).toBe(false);
  });

  it('is false when validUntil is in the future', () => {
    expect(isEvidenceExpired(new Date(Date.UTC(2026, 5, 16)), today)).toBe(false);
  });

  it('is false when validUntil is exactly today', () => {
    expect(isEvidenceExpired(today, today)).toBe(false);
  });

  it('is true when validUntil has passed', () => {
    expect(isEvidenceExpired(new Date(Date.UTC(2026, 5, 14)), today)).toBe(true);
  });
});

describe('assertEvidenceEditable (FR-009)', () => {
  it('accepts ACTIVE', () => {
    expect(() => assertEvidenceEditable('ACTIVE')).not.toThrow();
  });

  it('rejects ARCHIVED', () => {
    expect(() => assertEvidenceEditable('ARCHIVED')).toThrow(ValidationDomainError);
  });
});

describe('assertEvidenceLinkable (adversarial-test decision, spec.md edge cases)', () => {
  it('accepts ACTIVE — new links may be created', () => {
    expect(() => assertEvidenceLinkable('ACTIVE')).not.toThrow();
  });

  it('rejects ARCHIVED — an archived record may not gain a new link', () => {
    expect(() => assertEvidenceLinkable('ARCHIVED')).toThrow(ValidationDomainError);
  });
});
