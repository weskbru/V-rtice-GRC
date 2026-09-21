import { describe, expect, it } from 'vitest';

import { PRIVILEGED_PERMISSION_IDENTIFIERS, isPrivilegedRole } from './role-privilege';

import type { Permission, Role } from '../../types';

/**
 * 015-roles-permissions-surface — the client-side guard ADR-021 asks for
 * (spec.md FR-035/FR-036, SC-005).
 *
 * Two things are being protected here, and the second one is why this file
 * exists at all:
 *
 * 1. The classification is a PURE function of the role's own permission
 *    list: the three governance identifiers, and only those three, make it
 *    true. The `risk:administer` case below is the one that distinguishes
 *    the chosen rule from the alternative research.md R-001 discarded
 *    ("anything whose action is ADMINISTER"), which would have marked 6 of
 *    the 12 seeded roles and said something false about the security model.
 *
 * 2. The classification reaches nothing but the screen. This module imports
 *    a type and nothing else — no client, no store, no request — so a
 *    reviewer can see at a glance that no authorization decision, no fetch
 *    and no rendering of sensitive data can depend on it.
 */

function permission(identifier: string): Permission {
  const separator = identifier.indexOf(':');
  return {
    identifier,
    resource: separator >= 0 ? identifier.slice(0, separator) : identifier,
    action: 'ADMINISTER',
    description: `Description of ${identifier}`,
  };
}

function role(identifiers: readonly string[]): Role {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Test Role',
    description: 'A role assembled for this test only.',
    isSystem: false,
    permissions: identifiers.map(permission),
    assignedUserCount: 0,
  };
}

describe('isPrivilegedRole', () => {
  it('classifies a role granting role:administer as privileged', () => {
    expect(isPrivilegedRole(role(['role:administer']))).toBe(true);
  });

  it('classifies a role granting user:administer as privileged', () => {
    expect(isPrivilegedRole(role(['user:administer']))).toBe(true);
  });

  it('classifies a role granting org_unit:administer as privileged', () => {
    expect(isPrivilegedRole(role(['org_unit:administer']))).toBe(true);
  });

  it('classifies a role granting all three as privileged', () => {
    expect(
      isPrivilegedRole(role(['role:administer', 'user:administer', 'org_unit:administer'])),
    ).toBe(true);
  });

  /**
   * The case that makes the rule meaningful: `risk:administer` administers a
   * business domain, not access. A role holding it — and none of the three —
   * is NOT privileged, however many other permissions it carries.
   */
  it('does NOT classify risk:administer as privileged, alone or among many', () => {
    expect(isPrivilegedRole(role(['risk:administer']))).toBe(false);
    expect(
      isPrivilegedRole(
        role([
          'risk:view',
          'risk:create',
          'risk:edit',
          'risk:approve',
          'risk:administer',
          'control:administer',
          'asset:administer',
          'process:administer',
          'evidence:administer',
          'finding:administer',
          'compliance:administer',
          'methodology:administer',
        ]),
      ),
    ).toBe(false);
  });

  it('does not classify a role with no permissions at all', () => {
    expect(isPrivilegedRole(role([]))).toBe(false);
  });

  it('finds the governance permission wherever it sits in the list', () => {
    expect(isPrivilegedRole(role(['risk:view', 'audit:view', 'org_unit:administer']))).toBe(true);
  });

  it('matches the full identifier, never a prefix or a resource name', () => {
    expect(isPrivilegedRole(role(['role:view']))).toBe(false);
    expect(isPrivilegedRole(role(['user:view']))).toBe(false);
    expect(isPrivilegedRole(role(['org_unit:view']))).toBe(false);
  });

  it('is a pure read: the role it was given is not mutated', () => {
    const subject = role(['role:administer', 'risk:view']);
    const before = JSON.stringify(subject);
    isPrivilegedRole(subject);
    expect(JSON.stringify(subject)).toBe(before);
  });
});

describe('PRIVILEGED_PERMISSION_IDENTIFIERS', () => {
  /**
   * ADR-021 names three identifiers. A fourth added here silently would
   * widen the label without the ADR that authorizes it — so the set itself
   * is asserted, not only its effect.
   */
  it('is exactly the three governance identifiers ADR-021 names', () => {
    expect([...PRIVILEGED_PERMISSION_IDENTIFIERS].sort()).toEqual([
      'org_unit:administer',
      'role:administer',
      'user:administer',
    ]);
  });
});
