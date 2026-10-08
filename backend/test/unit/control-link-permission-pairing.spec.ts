import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_DEFINITIONS } from '../../seeds/platform.seed';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

const CONTROL_LINKING_PERMISSIONS: readonly {
  readonly permission: PermissionIdentifier;
  readonly description: string;
}[] = [
  { permission: 'risk:treat', description: 'POST /risks/{riskId}/controls' },
  { permission: 'compliance:map', description: 'POST /requirements/{requirementId}/controls' },
];

describe('Control link authority implies control browse permission', () => {
  it.each(CONTROL_LINKING_PERMISSIONS)(
    'every seeded role holding $permission also holds control:view ($description)',
    ({ permission }) => {
      const offenders = SYSTEM_ROLE_DEFINITIONS.filter((role) => {
        const permissions = new Set(role.permissions);
        return permissions.has(permission) && !permissions.has('control:view');
      }).map((role) => role.name);

      expect(offenders).toEqual([]);
    },
  );

  it.each(CONTROL_LINKING_PERMISSIONS)(
    'at least one seeded role actually holds both $permission and control:view — the guard is not vacuously true',
    ({ permission }) => {
      const paired = SYSTEM_ROLE_DEFINITIONS.filter((role) => {
        const permissions = new Set(role.permissions);
        return permissions.has(permission) && permissions.has('control:view');
      });

      expect(paired.length).toBeGreaterThan(0);
    },
  );
});
