/**
 * Role/permission/organizational-scope fixtures for tests that need a real,
 * concrete authorization outcome (US2's `risk-permissions`/`risk-crud`/
 * `risk-concurrency` specs) — nothing in `test/integration/support/`
 * covered this before Risk Management, because Phase 2/US1's own tests
 * never needed a caller with a SPECIFIC permission set (they exercised
 * authentication/session/audit, not `@RequirePermission`-gated business
 * endpoints).
 *
 * `Permission`/`Role`/`UserRole`/`OrgScopeGrant` are all TRUNCATED once, in
 * `global-setup.ts`, before the whole integration/contract run starts (see
 * `database-roles.ts`) — no `seedPlatform` call happens automatically for
 * these test suites, so every test that needs a permission or a role must
 * create its own via the fixtures below, using plain `create` (not
 * `upsert`): each call uses a fresh, unique identifier/name, so there is no
 * collision to guard against within a single test run.
 */
import { randomUUID } from 'node:crypto';

import { OrgScopeType, type OrgScopeGrant, type Role, type User } from '@prisma/client';

import { getAllPermissionDefinitions } from '../../../src/permission-catalogue';

import type { PermissionIdentifier } from '../../../src/core/authorization/domain/permissions';
import type { PrismaService } from '../../../src/infrastructure/prisma/prisma.service';

/** Creates the `Permission` row for `identifier` (looked up from the real
 * catalogue, `src/permission-catalogue.ts` — never a hand-invented
 * resource/action, so a typo'd identifier fails loudly here instead of
 * silently creating a permission nothing ever checks against).
 *
 * T206a — THROWAWAY PROBE (SC-011) surfaced a real pre-existing bug here,
 * kept fixed regardless of the probe's own removal: this function used to
 * snapshot `getAllPermissionDefinitions()` into a MODULE-LEVEL `const`,
 * evaluated once when this file is first imported — i.e. at test
 * COLLECTION time, before any spec's `beforeAll` has run and therefore
 * before a business module's own `*.module.ts` constructor had run. That
 * mattered because the permission extension point's original design put a
 * future module's definitions behind a runtime `registerPermissionDefinitions`
 * call made from the module's own Nest composition root — a registration
 * order hazard by construction, and this fixture's module-level snapshot
 * was a second, independent instance of the exact same hazard.
 *
 * A3 (this repository) removed that hazard structurally rather than only
 * patching this one call site: `src/permission-catalogue.ts` now combines
 * core's and every module's permission definitions from plain, static
 * arrays at import time, with no runtime registration step and therefore
 * no ordering to get wrong. The per-call (not module-level) lookup here is
 * kept anyway — it costs nothing and remains the more defensive shape for
 * a fixture used across many spec files. */
export async function createPermissionFixture(
  prisma: PrismaService,
  identifier: PermissionIdentifier,
): Promise<{ id: string; identifier: string }> {
  const definition = getAllPermissionDefinitions().find((d) => d.identifier === identifier);
  if (!definition) {
    throw new Error(
      `createPermissionFixture: "${identifier}" is not a registered permission identifier.`,
    );
  }

  // `upsert`, not `create`: permission identifiers are fixed, shared
  // strings (`risk:create`, ...) — multiple tests/roles within the same
  // spec file legitimately want the SAME `Permission` row, not a fresh one
  // colliding on the `identifier` unique constraint.
  return prisma.client.permission.upsert({
    where: { identifier: definition.identifier },
    create: {
      identifier: definition.identifier,
      resource: definition.resource,
      action: definition.action,
      description: definition.description,
    },
    update: {},
    select: { id: true, identifier: true },
  });
}

export interface RoleWithPermissionsFixtureOverrides {
  readonly id?: string;
  readonly name?: string;
}

/** Creates a `Role` carrying exactly `permissionIdentifiers` (each a fresh
 * `Permission` row created via `createPermissionFixture`, plus the
 * `RolePermission` links). */
export async function createRoleWithPermissionsFixture(
  prisma: PrismaService,
  permissionIdentifiers: readonly PermissionIdentifier[],
  overrides: RoleWithPermissionsFixtureOverrides = {},
): Promise<Role> {
  const role = await prisma.client.role.create({
    data: {
      id: overrides.id ?? randomUUID(),
      name: overrides.name ?? `fixture-role-${randomUUID()}`,
      description: 'Fixture role for tests.',
      isSystem: false,
    },
  });

  for (const identifier of permissionIdentifiers) {
    const permission = await createPermissionFixture(prisma, identifier);
    await prisma.client.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });
  }

  return role;
}

/** Assigns `role` to `user` (`UserRole`). `grantedByUserId` defaults to the
 * user themself — the identity of the granter is irrelevant to every test
 * this fixture serves. */
export async function assignRoleFixture(
  prisma: PrismaService,
  input: { user: User; role: Role; grantedByUserId?: string },
): Promise<void> {
  await prisma.client.userRole.create({
    data: {
      userId: input.user.id,
      roleId: input.role.id,
      grantedByUserId: input.grantedByUserId ?? input.user.id,
      grantedAt: new Date(),
    },
  });
}

/** Grants `user` a `UNIT` organizational scope over `orgUnitId` (ADR-004).
 * `grantedByUserId` defaults to the user themself, same reasoning as
 * `assignRoleFixture`. */
export async function grantUnitScopeFixture(
  prisma: PrismaService,
  input: { user: User; orgUnitId: string; grantedByUserId?: string },
): Promise<OrgScopeGrant> {
  return prisma.client.orgScopeGrant.create({
    data: {
      userId: input.user.id,
      scopeType: OrgScopeType.UNIT,
      orgUnitId: input.orgUnitId,
      grantedByUserId: input.grantedByUserId ?? input.user.id,
      grantedAt: new Date(),
    },
  });
}

/**
 * F-CV-2 (`risks-lifecycle-audit`): grants `user` exactly what
 * `CreateRiskUseCase`/`UpdateRiskUseCase` additionally require of an
 * owner/responsible candidate beyond assignment-line membership —
 * `risk:view` plus a `UNIT` scope grant reaching `orgUnitId`
 * (`AssignmentLineService.isQuestionInScope` against the candidate's own
 * scope). Shared here because the same three-call sequence (role, assign,
 * grant) would otherwise be repeated verbatim across every contract spec
 * that creates a risk with a bare owner/responsible fixture whose
 * eligibility is a PRECONDITION, never the object of the test's own
 * assertion (test-reconciliation round, Case A).
 *
 * Never call this on a test's own restricted ACTOR (Case B) — that would
 * erase exactly the restriction the test exists to prove. Case B instead
 * gets a SECOND, separate user made visible via this same helper, used only
 * as owner/responsible, while the restricted actor keeps whatever narrower
 * permission/scope its own test already gave it.
 */
export async function makeRiskAssignmentVisible(
  prisma: PrismaService,
  input: { user: User; orgUnitId: string },
): Promise<void> {
  const role = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
    name: `fixture-risk-visibility-role-${randomUUID()}`,
  });
  await assignRoleFixture(prisma, { user: input.user, role });
  await grantUnitScopeFixture(prisma, { user: input.user, orgUnitId: input.orgUnitId });
}

/** Grants `user` a `GLOBAL` organizational scope (ADR-004, FR-025a). */
export async function grantGlobalScopeFixture(
  prisma: PrismaService,
  input: { user: User; grantedByUserId?: string },
): Promise<OrgScopeGrant> {
  return prisma.client.orgScopeGrant.create({
    data: {
      userId: input.user.id,
      scopeType: OrgScopeType.GLOBAL,
      orgUnitId: null,
      grantedByUserId: input.grantedByUserId ?? input.user.id,
      grantedAt: new Date(),
    },
  });
}
