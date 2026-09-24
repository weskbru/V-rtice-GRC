import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_DEFINITIONS } from '../../seeds/platform.seed';

describe('finding:link authority implies control:view AND risk:view (ADR-020 part 5)', () => {
  it('every seeded role holding finding:link also holds control:view', () => {
    const offenders = SYSTEM_ROLE_DEFINITIONS.filter((role) => {
      const permissions = new Set(role.permissions);
      return permissions.has('finding:link') && !permissions.has('control:view');
    }).map((role) => role.name);

    expect(offenders).toEqual([]);
  });

  it('every seeded role holding finding:link also holds risk:view', () => {
    const offenders = SYSTEM_ROLE_DEFINITIONS.filter((role) => {
      const permissions = new Set(role.permissions);
      return permissions.has('finding:link') && !permissions.has('risk:view');
    }).map((role) => role.name);

    expect(offenders).toEqual([]);
  });

  it('at least one seeded role actually holds finding:link, control:view AND risk:view together — the guard is not vacuously true', () => {
    const paired = SYSTEM_ROLE_DEFINITIONS.filter((role) => {
      const permissions = new Set(role.permissions);
      return (
        permissions.has('finding:link') &&
        permissions.has('control:view') &&
        permissions.has('risk:view')
      );
    });

    expect(paired.length).toBeGreaterThan(0);
  });
});
