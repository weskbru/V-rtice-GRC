/**
 * Structural guard for the `GET /controls` ownership handover (Phase 2,
 * Controls), extended by ADR-020 part 5 (docs/architecture/decisions.md)
 * to cover every permission that lets a role CREATE a cross-module link to
 * a control.
 *
 * Until Phase 2, the control registry lived in the Risk module and was
 * gated by `risk:view` — so any role that could link a control to a risk
 * could, by construction, also browse the list it linked from. Phase 2 moved
 * that endpoint to the Controls module behind `control:view`, and those two
 * permissions are now independent. Nothing structural kept them together
 * afterwards.
 *
 * The failure that opens up is silent and nasty: a role that holds a
 * linking permission (`risk:treat` for `POST /risks/{riskId}/controls`,
 * `compliance:map` for `POST /requirements/{requirementId}/controls`) but
 * not `control:view` can still link a control it can no longer see — the
 * picker returns `403`, the user is shown an empty or broken control
 * selector, and no test anywhere notices, because each permission is
 * individually correct and only the PAIR is wrong. This is exactly the gap
 * `Compliance Manager` shipped with (`compliance:map` without
 * `control:view`) until this task fixed the seed.
 *
 * This asserts the pairing over the seeded role definitions themselves
 * rather than over HTTP: it needs no database, and it fails the moment
 * someone adds a role with link authority and forgets the browse permission —
 * which is exactly when a reviewer would not think to check.
 *
 * This test guards the SEED — a role defined wrong. It does NOT guard the
 * CODE: a custom role created at runtime through the admin UI can still
 * combine a linking permission with no `control:view`, which is exactly why
 * `LinkControlUseCase`/`LinkRequirementToControlUseCase` also enforce
 * `control:view` on the referenced control themselves (ADR-020 part 5),
 * independent of what any seeded role happens to look like.
 *
 * The direction matters and only one direction is asserted, for each
 * linking permission. Neither implies the reverse — `Control Owner` and
 * `Control Approver` legitimately browse controls with no linking authority
 * over risks or requirements at all.
 */
import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_DEFINITIONS } from '../../prisma/seed/platform.seed';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

/** Every permission that lets a role CREATE a link referencing a control
 * (ADR-020 part 5's "lado que registra"), paired with the module and
 * endpoint that requires it — kept as data so a future linking permission
 * is added here once, not rediscovered by whoever hits the same bug next. */
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
      // A guard that passes because nothing matches its precondition
      // protects nothing. This is the half that fails if a linking
      // permission is ever renamed and the filter above silently stops
      // matching anything.
      const paired = SYSTEM_ROLE_DEFINITIONS.filter((role) => {
        const permissions = new Set(role.permissions);
        return permissions.has(permission) && permissions.has('control:view');
      });

      expect(paired.length).toBeGreaterThan(0);
    },
  );
});
