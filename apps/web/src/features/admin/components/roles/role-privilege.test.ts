import { describe, expect, it } from 'vitest';

import { PRIVILEGED_PERMISSION_IDENTIFIERS, isPrivilegedRole } from './role-privilege';

import type { Permission, Role } from '../../types';

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
  it('is exactly the three governance identifiers ADR-021 names', () => {
    expect([...PRIVILEGED_PERMISSION_IDENTIFIERS].sort()).toEqual([
      'org_unit:administer',
      'role:administer',
      'user:administer',
    ]);
  });
});
