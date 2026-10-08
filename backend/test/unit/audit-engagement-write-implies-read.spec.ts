import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_DEFINITIONS } from '../../seeds/platform.seed';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

const AUDIT_ENGAGEMENT_WRITE_PERMISSIONS: readonly PermissionIdentifier[] = [
  'audit-engagement:create',
  'audit-engagement:edit',
  'audit-engagement:scope',
  'audit-engagement:transition',
];

const FINDING_WRITE_PERMISSIONS: readonly PermissionIdentifier[] = [
  'finding:create',
  'finding:close',
  'finding:remediate',
  'finding:link',
];

function rolesHoldingAnyOf(writes: readonly PermissionIdentifier[]): readonly string[] {
  return SYSTEM_ROLE_DEFINITIONS.filter((role) => {
    const permissions = new Set<string>(role.permissions);
    return writes.some((write) => permissions.has(write));
  }).map((role) => role.name);
}

function offendersMissing(
  writes: readonly PermissionIdentifier[],
  read: PermissionIdentifier,
): readonly string[] {
  return SYSTEM_ROLE_DEFINITIONS.filter((role) => {
    const permissions = new Set<string>(role.permissions);
    return writes.some((write) => permissions.has(write)) && !permissions.has(read);
  }).map((role) => role.name);
}

describe('a seeded role that may write a resource can also read it', () => {
  it('every seeded role holding any audit-engagement write authority also holds audit-engagement:view', () => {
    expect(offendersMissing(AUDIT_ENGAGEMENT_WRITE_PERMISSIONS, 'audit-engagement:view')).toEqual(
      [],
    );
  });

  it('every seeded role holding any finding write authority also holds finding:view', () => {
    expect(offendersMissing(FINDING_WRITE_PERMISSIONS, 'finding:view')).toEqual([]);
  });

  it('at least one seeded role actually holds audit-engagement write authority — the guard is not vacuously true', () => {
    expect(rolesHoldingAnyOf(AUDIT_ENGAGEMENT_WRITE_PERMISSIONS).length).toBeGreaterThan(0);
  });

  it('at least one seeded role actually holds finding write authority — the guard is not vacuously true', () => {
    expect(rolesHoldingAnyOf(FINDING_WRITE_PERMISSIONS).length).toBeGreaterThan(0);
  });

  it('Audit Lead can read both resources it is seeded to write', () => {
    const auditLead = SYSTEM_ROLE_DEFINITIONS.find((role) => role.name === 'Audit Lead');
    expect(auditLead).toBeDefined();

    const permissions = new Set<string>(auditLead?.permissions ?? []);
    expect(permissions.has('audit-engagement:view')).toBe(true);
    expect(permissions.has('finding:view')).toBe(true);
  });
});
