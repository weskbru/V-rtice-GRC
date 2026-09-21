/**
 * T068/005-audit-findings — structural guard mirroring
 * `control-link-permission-pairing.spec.ts` exactly (see that file's own
 * header for the full "why a seed-level guard, not only a runtime check"
 * account this one does not repeat), extended to the pair this module
 * introduces: `finding:link` governs BOTH `POST /findings/{id}/controls`
 * AND `POST /findings/{id}/risks` (one permission, two referenced types —
 * research.md D-7), so a role holding it must hold BOTH `control:view` AND
 * `risk:view`, or it can create a link it can never browse the picker for
 * on one of the two sides.
 *
 * This test guards the SEED, not the code — `LinkFindingControlUseCase`/
 * `LinkFindingRiskUseCase` independently enforce `control:view`/`risk:view`
 * on the referenced side themselves (ADR-020 part 5), regardless of what a
 * seeded role looks like; a custom role created at runtime can still
 * combine `finding:link` with neither view permission.
 */
import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_DEFINITIONS } from '../../prisma/seed/platform.seed';

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
