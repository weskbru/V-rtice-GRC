/**
 * T047/002-shared-grc-foundation, US2 — unit coverage for `Action`'s pure
 * domain invariants and transition table
 * (`grc/action/domain/action.entity.ts`). No I/O, no framework — mirrors
 * `test/unit/evidence.entity.spec.ts`'s structure.
 *
 * Exhaustively exercises all sixteen `(from, to)` pairs `ActionStatus`
 * allows — five legal, eleven illegal (including four same-state
 * "transitions") — so the transition table itself, not just a sample, is
 * proven (T040).
 */
import { describe, expect, it } from 'vitest';

import {
  actionTransitionEventName,
  assertLegalActionTransition,
  assertReopenReasonProvided,
  isLegalActionTransition,
} from '../../src/grc/action/domain/action.entity';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';

import type { ActionStatus } from '@prisma/client';

const ALL_STATUSES: readonly ActionStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const LEGAL_PAIRS: readonly [ActionStatus, ActionStatus][] = [
  ['OPEN', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'COMPLETED'],
  ['COMPLETED', 'OPEN'],
  ['OPEN', 'CANCELLED'],
  ['IN_PROGRESS', 'CANCELLED'],
];

describe('isLegalActionTransition / assertLegalActionTransition (data-model.md §4)', () => {
  it('accepts exactly the five documented edges and rejects every other pair', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const expected = LEGAL_PAIRS.some(([f, t]) => f === from && t === to);
        expect(isLegalActionTransition(from, to)).toBe(expected);
        if (expected) {
          expect(() => assertLegalActionTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertLegalActionTransition(from, to)).toThrow(ValidationDomainError);
        }
      }
    }
  });

  it('CANCELLED is terminal — no outgoing edge at all', () => {
    for (const to of ALL_STATUSES) {
      expect(isLegalActionTransition('CANCELLED', to)).toBe(false);
    }
  });

  it('OPEN -> COMPLETED (skipping IN_PROGRESS) is deliberately illegal', () => {
    expect(isLegalActionTransition('OPEN', 'COMPLETED')).toBe(false);
  });

  it('a same-state pair is never legal (never silently a no-op "transition")', () => {
    for (const status of ALL_STATUSES) {
      expect(isLegalActionTransition(status, status)).toBe(false);
    }
  });
});

describe('assertReopenReasonProvided (Invariant A2)', () => {
  it('rejects undefined, null, empty, and whitespace-only reasons', () => {
    expect(() => assertReopenReasonProvided(undefined)).toThrow(ValidationDomainError);
    expect(() => assertReopenReasonProvided(null)).toThrow(ValidationDomainError);
    expect(() => assertReopenReasonProvided('')).toThrow(ValidationDomainError);
    expect(() => assertReopenReasonProvided('   ')).toThrow(ValidationDomainError);
  });

  it('accepts a non-empty reason', () => {
    expect(() => assertReopenReasonProvided('Correção incompleta.')).not.toThrow();
  });
});

describe('actionTransitionEventName (FR-028 — one semantic event per transition)', () => {
  it('names exactly one event for every ActionStatus target, never a generic one', () => {
    expect(actionTransitionEventName('IN_PROGRESS')).toBe('action.started');
    expect(actionTransitionEventName('COMPLETED')).toBe('action.completed');
    expect(actionTransitionEventName('CANCELLED')).toBe('action.cancelled');
    expect(actionTransitionEventName('OPEN')).toBe('action.reopened');
  });

  it('every legal transition target maps to a name distinct from "action.updated"', () => {
    for (const [, to] of LEGAL_PAIRS) {
      expect(actionTransitionEventName(to)).not.toBe('action.updated');
    }
  });
});
