import { describe, expect, it } from 'vitest';

import {
  assertCloserNotResponsibleForCompletedAction,
  assertFindingCanBeReopened,
  assertFindingCloseRequirementMet,
  assertFindingEditable,
  assertFindingHasSupportingEvidence,
  assertLegalFindingTransition,
  assertReopenReasonProvided,
  isLegalFindingTransition,
} from '../../src/grc/finding/domain/finding.entity';
import { ForbiddenDomainError, ValidationDomainError } from '../../src/shared/errors/domain-error';

import type { FindingStatus } from '@prisma/client';

const ALL_STATUSES: readonly FindingStatus[] = ['OPEN', 'IN_REMEDIATION', 'CLOSED', 'ARCHIVED'];

const LEGAL_PAIRS: readonly [FindingStatus, FindingStatus][] = [
  ['OPEN', 'IN_REMEDIATION'],
  ['OPEN', 'CLOSED'],
  ['IN_REMEDIATION', 'CLOSED'],
  ['CLOSED', 'ARCHIVED'],
  ['CLOSED', 'IN_REMEDIATION'],
];

describe('isLegalFindingTransition / assertLegalFindingTransition (data-model.md §5)', () => {
  it('accepts exactly the five documented edges and rejects every other pair', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const expected = LEGAL_PAIRS.some(([f, t]) => f === from && t === to);
        expect(isLegalFindingTransition(from, to)).toBe(expected);
        if (expected) {
          expect(() => assertLegalFindingTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertLegalFindingTransition(from, to)).toThrow(ValidationDomainError);
        }
      }
    }
  });

  it('ARCHIVED is terminal — no outgoing edge at all', () => {
    for (const to of ALL_STATUSES) {
      expect(isLegalFindingTransition('ARCHIVED', to)).toBe(false);
    }
  });

  it('a same-state pair is never legal (never silently a no-op "transition")', () => {
    for (const status of ALL_STATUSES) {
      expect(isLegalFindingTransition(status, status)).toBe(false);
    }
  });

  it('Invariant F4: only CLOSED may transition to ARCHIVED — every other status is 422', () => {
    for (const from of ALL_STATUSES) {
      if (from === 'CLOSED') {
        expect(() => assertLegalFindingTransition(from, 'ARCHIVED')).not.toThrow();
      } else {
        expect(() => assertLegalFindingTransition(from, 'ARCHIVED')).toThrow(ValidationDomainError);
      }
    }
  });

  it('IN_REMEDIATION is reachable both via CLOSED -> IN_REMEDIATION (reopen) and, since 005-audit-findings/T047, directly from OPEN (StartFindingRemediationUseCase) — both edges are legal in this UNCHANGED table', () => {
    expect(isLegalFindingTransition('CLOSED', 'IN_REMEDIATION')).toBe(true);
    expect(isLegalFindingTransition('OPEN', 'IN_REMEDIATION')).toBe(true);
  });
});

describe('assertFindingCloseRequirementMet (Invariant F1)', () => {
  it('rejects when there is no completed linked action and no justification', () => {
    expect(() => assertFindingCloseRequirementMet(false, undefined)).toThrow(ValidationDomainError);
    expect(() => assertFindingCloseRequirementMet(false, null)).toThrow(ValidationDomainError);
    expect(() => assertFindingCloseRequirementMet(false, '')).toThrow(ValidationDomainError);
    expect(() => assertFindingCloseRequirementMet(false, '   ')).toThrow(ValidationDomainError);
  });

  it('accepts a completed linked action alone, with no justification', () => {
    expect(() => assertFindingCloseRequirementMet(true, undefined)).not.toThrow();
  });

  it('accepts a justification alone, with no completed linked action', () => {
    expect(() =>
      assertFindingCloseRequirementMet(false, 'Aceito formalmente sem remediação.'),
    ).not.toThrow();
  });

  it('accepts both present at once', () => {
    expect(() => assertFindingCloseRequirementMet(true, 'Também documentado.')).not.toThrow();
  });
});

describe('assertFindingHasSupportingEvidence (Invariant F5, T050/005-audit-findings, FR-010)', () => {
  it('rejects when no active evidence link exists', () => {
    expect(() => assertFindingHasSupportingEvidence(false)).toThrow(ValidationDomainError);
  });

  it('accepts when an active evidence link exists', () => {
    expect(() => assertFindingHasSupportingEvidence(true)).not.toThrow();
  });
});

describe('assertCloserNotResponsibleForCompletedAction (Invariant F2 — segregation of duties)', () => {
  it('refuses when the closer is responsible for a completed linked action', () => {
    expect(() =>
      assertCloserNotResponsibleForCompletedAction('user-a', ['user-b', 'user-a']),
    ).toThrow(ForbiddenDomainError);
  });

  it('allows when the closer is not among the completed actions’ responsibles', () => {
    expect(() =>
      assertCloserNotResponsibleForCompletedAction('user-c', ['user-a', 'user-b']),
    ).not.toThrow();
  });

  it('allows when there are no completed linked actions at all', () => {
    expect(() => assertCloserNotResponsibleForCompletedAction('user-a', [])).not.toThrow();
  });
});

describe('assertFindingCanBeReopened — reopen’s own precondition, narrower than the general table', () => {
  it('allows reopening only from CLOSED, even though OPEN -> IN_REMEDIATION is a legal table edge', () => {
    expect(() => assertFindingCanBeReopened('CLOSED')).not.toThrow();
    for (const status of ALL_STATUSES) {
      if (status === 'CLOSED') continue;
      expect(() => assertFindingCanBeReopened(status)).toThrow(ValidationDomainError);
    }
  });
});

describe('assertReopenReasonProvided', () => {
  it('rejects undefined, null, empty, and whitespace-only reasons', () => {
    expect(() => assertReopenReasonProvided(undefined)).toThrow(ValidationDomainError);
    expect(() => assertReopenReasonProvided(null)).toThrow(ValidationDomainError);
    expect(() => assertReopenReasonProvided('')).toThrow(ValidationDomainError);
    expect(() => assertReopenReasonProvided('   ')).toThrow(ValidationDomainError);
  });

  it('accepts a non-empty reason', () => {
    expect(() => assertReopenReasonProvided('Remediação insuficiente.')).not.toThrow();
  });
});

describe('assertFindingEditable (Phase 6 correction — mirrors Evidence’s assertEvidenceEditable)', () => {
  it('rejects edits once ARCHIVED', () => {
    expect(() => assertFindingEditable('ARCHIVED')).toThrow(ValidationDomainError);
  });

  it('allows edits for every non-ARCHIVED status, including CLOSED — post-closure correction is legitimate', () => {
    for (const status of ALL_STATUSES) {
      if (status === 'ARCHIVED') continue;
      expect(() => assertFindingEditable(status)).not.toThrow();
    }
  });
});
