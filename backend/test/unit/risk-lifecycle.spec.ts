import { describe, expect, it } from 'vitest';

import {
  findLifecycleTransition,
  listLifecycleTransitionsFrom,
} from '../../src/modules/risk/domain/risk-lifecycle';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';
import type { LifecycleTransitionRule } from '../../src/modules/risk/domain/risk-lifecycle';
import type { RiskStatus } from '@prisma/client';

const ALL_STATUSES: readonly RiskStatus[] = [
  'DRAFT',
  'IDENTIFIED',
  'ASSESSED',
  'UNDER_TREATMENT',
  'UNDER_REVIEW',
  'ACCEPTED',
  'CLOSED',
  'ARCHIVED',
];

const EXPECTED_LEGAL: readonly Omit<LifecycleTransitionRule, 'preconditions'>[] = [
  { from: 'DRAFT', to: 'IDENTIFIED', requiredPermission: 'risk:edit', requiresApproval: false },
  {
    from: 'IDENTIFIED',
    to: 'ASSESSED',
    requiredPermission: 'risk:assess',
    requiresApproval: false,
  },
  {
    from: 'ASSESSED',
    to: 'UNDER_TREATMENT',
    requiredPermission: 'risk:treat',
    requiresApproval: false,
  },
  {
    from: 'ASSESSED',
    to: 'UNDER_REVIEW',
    requiredPermission: 'risk:transition',
    requiresApproval: false,
  },
  {
    from: 'UNDER_TREATMENT',
    to: 'UNDER_REVIEW',
    requiredPermission: 'risk:transition',
    requiresApproval: false,
  },
  {
    from: 'ASSESSED',
    to: 'ACCEPTED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
  },
  {
    from: 'UNDER_TREATMENT',
    to: 'ACCEPTED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
  },
  {
    from: 'UNDER_REVIEW',
    to: 'ACCEPTED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
  },
  { from: 'ACCEPTED', to: 'CLOSED', requiredPermission: 'risk:transition', requiresApproval: true },
  {
    from: 'UNDER_TREATMENT',
    to: 'CLOSED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
  },
  {
    from: 'UNDER_REVIEW',
    to: 'CLOSED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
  },
  {
    from: 'CLOSED',
    to: 'ARCHIVED',
    requiredPermission: 'risk:administer',
    requiresApproval: false,
  },
  {
    from: 'UNDER_REVIEW',
    to: 'ASSESSED',
    requiredPermission: 'risk:assess',
    requiresApproval: false,
  },
];

function legalKey(from: RiskStatus, to: RiskStatus): string {
  return `${from}->${to}`;
}

const EXPECTED_BY_KEY = new Map(EXPECTED_LEGAL.map((rule) => [legalKey(rule.from, rule.to), rule]));

describe('Risk lifecycle transition table (T147, ADR-006, FR-079 to FR-081)', () => {
  it('has exactly 13 legal transitions, matching ADR-006 one-for-one', () => {
    expect(EXPECTED_LEGAL).toHaveLength(13);
  });

  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const expected = EXPECTED_BY_KEY.get(legalKey(from, to));

      if (expected) {
        it(`accepts the legal transition ${from} -> ${to} with permission ${expected.requiredPermission} and requiresApproval=${String(expected.requiresApproval)}`, () => {
          const rule = findLifecycleTransition(from, to);
          expect(rule).toBeDefined();
          expect(rule!.requiredPermission).toBe(expected.requiredPermission);
          expect(rule!.requiresApproval).toBe(expected.requiresApproval);
        });
      } else {
        it(`refuses the illegal (from, to) pair ${from} -> ${to}`, () => {
          expect(findLifecycleTransition(from, to)).toBeUndefined();
        });
      }
    }
  }

  it('requesting and deciding an approval-gated transition are different permissions (FR-029, FR-029a)', () => {
    const gatedRules = EXPECTED_LEGAL.filter((rule) => rule.requiresApproval);
    expect(gatedRules.length).toBeGreaterThan(0);
    for (const rule of gatedRules) {
      const requestPermission: PermissionIdentifier = rule.requiredPermission;
      expect(requestPermission).toBe('risk:transition');
      expect(requestPermission).not.toBe('risk:approve');
    }
  });

  it('listLifecycleTransitionsFrom returns every legal target for a given state, and only those', () => {
    for (const from of ALL_STATUSES) {
      const expectedTargets = EXPECTED_LEGAL.filter((rule) => rule.from === from)
        .map((rule) => rule.to)
        .sort();
      const actualTargets = listLifecycleTransitionsFrom(from)
        .map((rule) => rule.to)
        .sort();
      expect(actualTargets).toEqual(expectedTargets);
    }
  });

  it('DRAFT -> IDENTIFIED requires the DRAFT_FIELDS_COMPLETE precondition (FR-055)', () => {
    const rule = findLifecycleTransition('DRAFT', 'IDENTIFIED');
    expect(rule!.preconditions).toEqual(['DRAFT_FIELDS_COMPLETE']);
  });

  it('IDENTIFIED -> ASSESSED requires the HAS_ASSESSMENT precondition', () => {
    const rule = findLifecycleTransition('IDENTIFIED', 'ASSESSED');
    expect(rule!.preconditions).toEqual(['HAS_ASSESSMENT']);
  });

  it('ASSESSED -> UNDER_TREATMENT requires the HAS_TREATMENT_DECISION precondition', () => {
    const rule = findLifecycleTransition('ASSESSED', 'UNDER_TREATMENT');
    expect(rule!.preconditions).toEqual(['HAS_TREATMENT_DECISION']);
  });

  it('every ACCEPTED-gated transition requires the HAS_ASSESSMENT precondition', () => {
    for (const from of ['ASSESSED', 'UNDER_TREATMENT', 'UNDER_REVIEW'] as const) {
      const rule = findLifecycleTransition(from, 'ACCEPTED');
      expect(rule!.preconditions).toEqual(['HAS_ASSESSMENT']);
    }
  });

  it('every CLOSED-gated transition has no precondition beyond permission and approval', () => {
    for (const from of ['ACCEPTED', 'UNDER_TREATMENT', 'UNDER_REVIEW'] as const) {
      const rule = findLifecycleTransition(from, 'CLOSED');
      expect(rule!.preconditions).toEqual([]);
    }
  });

  it('UNDER_REVIEW -> ASSESSED (the reassessment return path) requires REASSESSED_DURING_REVIEW', () => {
    const rule = findLifecycleTransition('UNDER_REVIEW', 'ASSESSED');
    expect(rule!.preconditions).toEqual(['REASSESSED_DURING_REVIEW']);
  });

  it('CLOSED -> ARCHIVED has no precondition and requires risk:administer, not risk:transition', () => {
    const rule = findLifecycleTransition('CLOSED', 'ARCHIVED');
    expect(rule!.preconditions).toEqual([]);
    expect(rule!.requiredPermission).toBe('risk:administer');
  });
});
