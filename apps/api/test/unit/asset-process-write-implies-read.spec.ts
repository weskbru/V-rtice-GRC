/**
 * T008/006-assets-processes — structural seed guard in the same shape as
 * `audit-engagement-write-implies-read.spec.ts` (see that file's header for
 * the full "why a seed-level guard, not only a runtime check" account this
 * file does not repeat), extended to the two resources this fase promotes:
 * **a role that may WRITE an asset or a process must also be able to READ
 * it.**
 *
 * Kept as a SIBLING file rather than added to
 * `audit-engagement-write-implies-read.spec.ts` itself, per this task's own
 * instruction ("ou uma irmã ao lado, se aquele arquivo ficar sobrecarregado")
 * — Asset/Process is an unrelated resource family from Audit Engagements/
 * Finding, and the existing file already covers two pairings of its own.
 *
 * ## The concrete defect this exists to prevent (research.md D-7, A-6)
 *
 * Today the only permission that grants access to the asset/process
 * inventory is `risk:view` (`RegistryController`, `modules/risk`) — this
 * fase moves that authority to the resource's own `asset:view`/
 * `process:view` (US2, FR-009). Every seeded role that held `risk:view` for
 * exactly that reason must also receive `asset:view`/`process:view` (T006),
 * or it silently loses inventory access it already had — an empty link
 * picker, with no error, the same class of defect the seeded **"Audit
 * Lead"** role produced in the previous fase (`f9e5e5b`): every WRITE
 * authority over an engagement and a finding, and neither READ permission.
 *
 * This fase introduces no seeded role with WRITE authority over an asset or
 * a process yet (`asset:create`/`asset:edit`/`asset:administer` and their
 * `process:*` equivalents are declared in the permission catalogue, T003/
 * T004, but no `SystemRoleDefinition` holds any of them — the use cases that
 * would exercise them are Fase 3's own scope). The guard is written now,
 * against that future, so a later seed change that grants
 * `asset:create`/`asset:edit`/`asset:administer` (or their `process:*`
 * equivalents) to some role cannot silently omit the matching `asset:view`/
 * `process:view` the way "Audit Lead" once did — catching the mistake at
 * the moment it is introduced, not after a later fase ships a UI that
 * depends on it.
 *
 * ## Why the assertion is "write implies read", not a fixed list
 *
 * Asserting the literal expected permission array of one named role would
 * pass against the correct seed and against a future role with the same
 * mistake (CLAUDE.md §18.8's own "a test that passes against the correct
 * and the incorrect code protects nothing"). The rule generalizes to every
 * call site sharing the vulnerable pattern, as AGENTS.md requires of a
 * security-adjacent fix: any seeded role, present or future, holding any
 * write authority over these two resources must hold the matching read.
 */
import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_DEFINITIONS } from '../../prisma/seed/platform.seed';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

/** Every write authority `asset-permissions.ts` declares, and the read
 * permission each of them presupposes. `asset:view` gates listing and
 * reading an asset — so holding any of `create`/`edit`/`administer` without
 * it yields a role that can change an asset it cannot see. */
const ASSET_WRITE_PERMISSIONS: readonly PermissionIdentifier[] = [
  'asset:create',
  'asset:edit',
  'asset:administer',
];

/** The process-side equivalent (FR-020: same shape as the asset side,
 * deliberately). */
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

/** Every role this fase's T006 grants `asset:view`/`process:view` to
 * (research.md D-7/A-6): every seeded role that held `risk:view` before
 * this fase, so none of them loses inventory access once the listing's
 * required permission moves off `risk:view` (US2, FR-009). Named
 * explicitly, rather than only asserted through `offendersMissing` above,
 * so a regression that strips one of these roles' new permissions fails
 * with a message that says which role broke — the same belt-and-suspenders
 * shape `audit-engagement-write-implies-read.spec.ts`'s own "Audit Lead"
 * assertion uses. */
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

  // Non-vacuity, the same third assertion the sibling guards carry.
  //
  // This was briefly written as `it.skip`, on the reasoning that "this fase
  // seeds no WRITE authority over either resource yet". That reasoning was
  // WRONG and the skip was unnecessary: `Platform Administrator` is seeded
  // with `ALL_PERMISSION_IDENTIFIERS`, which includes `asset:create`,
  // `asset:edit` and `asset:administer` the moment T003/T004 add them to
  // the catalogue — and `rolesHoldingAnyOf` below does not exclude it. The
  // assertion passes today, and it is enabled, because a skipped test is a
  // hole that stays open: the condition to un-skip it had already been met
  // when it was written.
  //
  // It still does real work. If a future change narrows
  // `Platform Administrator` away from the full catalogue, or removes the
  // write permissions entirely, the two assertions above would go
  // silently green over an empty set — and this one would fail instead.
  it('at least one seeded role actually holds asset or process write authority — the guard is not vacuously true', () => {
    expect(
      rolesHoldingAnyOf(ASSET_WRITE_PERMISSIONS).length +
        rolesHoldingAnyOf(PROCESS_WRITE_PERMISSIONS).length,
    ).toBeGreaterThan(0);
  });

  // T006's own obligation (research.md D-7/A-6): every role that reached
  // the inventory via `risk:view` before this fase must still reach it,
  // now via `asset:view`/`process:view` — named per role, not only via
  // `offendersMissing`, so a regression says which role broke.
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

  // The mirror of the assertion above: no seeded role holding `risk:view`
  // was missed by T006 — every role this fase must compensate is actually
  // listed in `ROLES_COMPENSATED_FOR_LOST_RISK_VIEW_ACCESS`. Platform
  // Administrator is excluded: it is seeded with
  // `getAllPermissionDefinitions()` in full (every identifier, including
  // `asset:view`/`process:view` automatically), not a hand-maintained list,
  // so it can never be the offender this assertion looks for.
  //
  // 008-incidents-problems, defect fix — `Problem Manager` is the first
  // role, introduced AFTER T006, that holds `risk:view` for a reason that
  // has NOTHING to do with reaching the asset/process inventory: it exists
  // solely to satisfy the ADR-020 part 5 paired-read check
  // `LinkProblemRiskUseCase` runs before writing `ProblemRiskLink` (spec.md
  // FR-013). `Problem` does not relate to `Asset`/`Process` in this fase
  // (`specs/008-incidents-problems/spec.md`'s own relation table — both
  // marked "Não nesta fase"), so `GET /assets`/`GET /processes` were never
  // reachable through this role's `risk:view` the way T006's compensation
  // concern describes, and granting `asset:view`/`process:view` here would
  // itself be the "grant a permission no role needs" defect. Narrowly
  // exempted BY NAME, with the reason recorded here — never a blanket "any
  // future role is exempt" escape hatch, so a genuinely careless omission
  // still fails this guard.
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
