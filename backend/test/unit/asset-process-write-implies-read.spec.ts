import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_DEFINITIONS } from '../../seeds/platform.seed';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

const ASSET_WRITE_PERMISSIONS: readonly PermissionIdentifier[] = [
  'asset:create',
  'asset:edit',
  'asset:administer',
];

const PROCESS_WRITE_PERMISSIONS: readonly PermissionIdentifier[] = [
  'process:create',
  'process:edit',
  'process:administer',
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

const ROLES_COMPENSATED_FOR_LOST_RISK_VIEW_ACCESS: readonly string[] = [
  'Risk Manager',
  'Risk Analyst',
  'Risk Approver',
  'Auditor',
  'Read Only',
  'Audit Lead',
];

describe('a seeded role that may write an asset or a process can also read it', () => {
  it('every seeded role holding any asset write authority also holds asset:view', () => {
    expect(offendersMissing(ASSET_WRITE_PERMISSIONS, 'asset:view')).toEqual([]);
  });

  it('every seeded role holding any process write authority also holds process:view', () => {
    expect(offendersMissing(PROCESS_WRITE_PERMISSIONS, 'process:view')).toEqual([]);
  });

  it('at least one seeded role actually holds asset or process write authority — the guard is not vacuously true', () => {
    expect(
      rolesHoldingAnyOf(ASSET_WRITE_PERMISSIONS).length +
        rolesHoldingAnyOf(PROCESS_WRITE_PERMISSIONS).length,
    ).toBeGreaterThan(0);
  });

  it.each(ROLES_COMPENSATED_FOR_LOST_RISK_VIEW_ACCESS)(
    '%s holds both asset:view and process:view (T006 compensation for the risk:view it depended on)',
    (roleName) => {
      const role = SYSTEM_ROLE_DEFINITIONS.find((definition) => definition.name === roleName);
      expect(role).toBeDefined();

      const permissions = new Set<string>(role?.permissions ?? []);
      expect(permissions.has('risk:view')).toBe(true);
      expect(permissions.has('asset:view')).toBe(true);
      expect(permissions.has('process:view')).toBe(true);
    },
  );

  const ROLES_EXEMPT_FROM_ASSET_PROCESS_VIEW_COMPENSATION: readonly string[] = ['Problem Manager'];

  it('no seeded role other than Platform Administrator (or a documented, named exemption) holds risk:view without also holding asset:view and process:view', () => {
    const offenders = SYSTEM_ROLE_DEFINITIONS.filter((role) => {
      if (
        role.name === 'Platform Administrator' ||
        ROLES_EXEMPT_FROM_ASSET_PROCESS_VIEW_COMPENSATION.includes(role.name)
      ) {
        return false;
      }
      const permissions = new Set<string>(role.permissions);
      return (
        permissions.has('risk:view') &&
        (!permissions.has('asset:view') || !permissions.has('process:view'))
      );
    }).map((role) => role.name);

    expect(offenders).toEqual([]);
  });
});
