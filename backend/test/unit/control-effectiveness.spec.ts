import { describe, expect, it } from 'vitest';

import {
  calculateControlEffectiveness,
  FREQUENCY_WINDOW_DAYS,
} from '../../src/modules/controls/domain/control-effectiveness.service';

import type { ControlAssessmentForEffectiveness } from '../../src/modules/controls/domain/control-effectiveness.service';

const REFERENCE_DATE = new Date(Date.UTC(2026, 8, 7));

function daysBefore(reference: Date, days: number): Date {
  return new Date(reference.getTime() - days * 24 * 60 * 60 * 1000);
}

function attested(
  overrides: Partial<ControlAssessmentForEffectiveness> = {},
): ControlAssessmentForEffectiveness {
  return {
    assessedOn: REFERENCE_DATE,
    createdAt: REFERENCE_DATE,
    result: 'EFFECTIVE',
    attestedAt: REFERENCE_DATE,
    ...overrides,
  };
}

function unattested(
  overrides: Partial<ControlAssessmentForEffectiveness> = {},
): ControlAssessmentForEffectiveness {
  return { ...attested(overrides), attestedAt: null };
}

describe('calculateControlEffectiveness (T013, data-model.md §3, D-2)', () => {
  describe('no attested assessment -> NOT_ASSESSED (FR-013)', () => {
    it('is NOT_ASSESSED with an empty history', () => {
      expect(calculateControlEffectiveness([], null, REFERENCE_DATE)).toBe('NOT_ASSESSED');
      expect(calculateControlEffectiveness([], 'MONTHLY', REFERENCE_DATE)).toBe('NOT_ASSESSED');
    });

    it('is NOT_ASSESSED — never EFFECTIVE by omission — when every assessment on record is unattested', () => {
      const history = [
        unattested({ result: 'EFFECTIVE' }),
        unattested({ result: 'INEFFECTIVE', assessedOn: daysBefore(REFERENCE_DATE, 10) }),
      ];
      expect(calculateControlEffectiveness(history, null, REFERENCE_DATE)).toBe('NOT_ASSESSED');
    });
  });

  describe('an unattested assessment does not count (FR-016 — recording is not declaring)', () => {
    it('ignores a MORE RECENT unattested assessment in favor of an older ATTESTED one', () => {
      const history = [
        attested({ result: 'INEFFECTIVE', assessedOn: daysBefore(REFERENCE_DATE, 2) }),
        unattested({ result: 'EFFECTIVE', assessedOn: REFERENCE_DATE }),
      ];
      expect(calculateControlEffectiveness(history, null, REFERENCE_DATE)).toBe('INEFFECTIVE');
    });

    it('a pending (never-decided) attestation is indistinguishable from never-requested — attestedAt null either way', () => {
      const pendingAttestation = unattested({ result: 'PARTIALLY_EFFECTIVE' });
      expect(calculateControlEffectiveness([pendingAttestation], null, REFERENCE_DATE)).toBe(
        'NOT_ASSESSED',
      );
    });
  });

  describe('null frequency makes EXPIRED unreachable (FR-015)', () => {
    it('returns the latest attested result verbatim no matter how old it is', () => {
      const veryOld = attested({
        result: 'EFFECTIVE',
        assessedOn: daysBefore(REFERENCE_DATE, 10_000),
      });
      expect(calculateControlEffectiveness([veryOld], null, REFERENCE_DATE)).toBe('EFFECTIVE');
    });

    it('never returns EXPIRED for any of the three assessable results', () => {
      for (const result of ['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE'] as const) {
        const old = attested({ result, assessedOn: daysBefore(REFERENCE_DATE, 100_000) });
        expect(calculateControlEffectiveness([old], null, REFERENCE_DATE)).not.toBe('EXPIRED');
      }
    });
  });

  describe('a stale window -> EXPIRED (FR-014)', () => {
    it('is EXPIRED when the latest attested assessment is strictly older than the declared frequency window', () => {
      const stale = attested({ assessedOn: daysBefore(REFERENCE_DATE, 60) });
      expect(calculateControlEffectiveness([stale], 'MONTHLY', REFERENCE_DATE)).toBe('EXPIRED');
    });

    it('is NOT expired when the latest attested assessment is within the window', () => {
      const fresh = attested({ result: 'EFFECTIVE', assessedOn: daysBefore(REFERENCE_DATE, 5) });
      expect(calculateControlEffectiveness([fresh], 'MONTHLY', REFERENCE_DATE)).toBe('EFFECTIVE');
    });

    it('is NOT expired exactly at the window boundary (strict "<", not "<=" — due today is not yet overdue)', () => {
      const atBoundary = attested({
        result: 'EFFECTIVE',
        assessedOn: daysBefore(REFERENCE_DATE, FREQUENCY_WINDOW_DAYS.WEEKLY),
      });
      expect(calculateControlEffectiveness([atBoundary], 'WEEKLY', REFERENCE_DATE)).toBe(
        'EFFECTIVE',
      );
    });

    it('is EXPIRED one day past the window boundary', () => {
      const pastBoundary = attested({
        assessedOn: daysBefore(REFERENCE_DATE, FREQUENCY_WINDOW_DAYS.WEEKLY + 1),
      });
      expect(calculateControlEffectiveness([pastBoundary], 'WEEKLY', REFERENCE_DATE)).toBe(
        'EXPIRED',
      );
    });

    it('every declared frequency has its own, independently-checkable window', () => {
      for (const [frequency, windowDays] of Object.entries(FREQUENCY_WINDOW_DAYS) as [
        keyof typeof FREQUENCY_WINDOW_DAYS,
        number,
      ][]) {
        const justInside = attested({ assessedOn: daysBefore(REFERENCE_DATE, windowDays) });
        const justOutside = attested({ assessedOn: daysBefore(REFERENCE_DATE, windowDays + 1) });
        expect(
          calculateControlEffectiveness([justInside], frequency, REFERENCE_DATE),
          `${frequency}: exactly ${String(windowDays)} days ago must not be EXPIRED`,
        ).not.toBe('EXPIRED');
        expect(
          calculateControlEffectiveness([justOutside], frequency, REFERENCE_DATE),
          `${frequency}: ${String(windowDays + 1)} days ago must be EXPIRED`,
        ).toBe('EXPIRED');
      }
    });
  });

  describe('most-recent selection: (assessedOn DESC, createdAt DESC) — data-model.md §2', () => {
    it('picks the later assessedOn over an earlier one regardless of array order', () => {
      const older = attested({ result: 'INEFFECTIVE', assessedOn: daysBefore(REFERENCE_DATE, 5) });
      const newer = attested({ result: 'EFFECTIVE', assessedOn: REFERENCE_DATE });
      expect(calculateControlEffectiveness([older, newer], null, REFERENCE_DATE)).toBe('EFFECTIVE');
      expect(calculateControlEffectiveness([newer, older], null, REFERENCE_DATE)).toBe('EFFECTIVE');
    });

    it('breaks a same-assessedOn tie by createdAt DESC', () => {
      const firstRecorded = attested({
        result: 'INEFFECTIVE',
        assessedOn: REFERENCE_DATE,
        createdAt: daysBefore(REFERENCE_DATE, 1),
      });
      const secondRecorded = attested({
        result: 'EFFECTIVE',
        assessedOn: REFERENCE_DATE,
        createdAt: REFERENCE_DATE,
      });
      expect(
        calculateControlEffectiveness([firstRecorded, secondRecorded], null, REFERENCE_DATE),
      ).toBe('EFFECTIVE');
    });
  });

  describe('every ControlAssessmentResult passes through verbatim when not expired', () => {
    it.each(['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE'] as const)(
      'returns %s unchanged',
      (result) => {
        expect(calculateControlEffectiveness([attested({ result })], null, REFERENCE_DATE)).toBe(
          result,
        );
      },
    );
  });
});
