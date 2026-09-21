/**
 * Assurance fix (Fix 7, confirmed gap) — `reconcileRolePermissions`
 * (`prisma/seed/platform.seed.ts`) adds AND removes `RolePermission` rows
 * directly through Prisma on every seed run, but used to never call
 * `bumpPermissionsVersion()` the way every application-level write path
 * that changes a role's permission set already does
 * (`core/authorization/application/role-admin.service.ts`). Since the seed
 * is the documented bootstrap AND redeploy path, a user with a warm
 * `PermissionResolverService` cache entry kept a permission the seed just
 * REMOVED for up to that cache's TTL — contradicting the platform's stated
 * "effective on the next request" guarantee.
 *
 * This exercises `seedPlatform` end to end, three times, against the real
 * test database (no cache/`PermissionResolverService` involved at all —
 * this only asserts the DURABLE counter `permission_cache_state
 * .permissions_version` the resolver's cache key is built from, which is
 * exactly what the fix touches and exactly what would fail to move without
 * it):
 *
 *   1. First run — every `RolePermission` this run creates or repairs for a
 *      system role that was not already fully converged is a real change,
 *      so the version must move at least once by the end of it.
 *   2. Immediate second run with NOTHING changed — a fully-converged
 *      re-seed (the common redeploy case) must NOT bump the version again;
 *      this is the "not spuriously" half of the fix.
 *   3. A permission is deleted directly from a known system role (`Risk
 *      Manager`, `risk:view`) — simulating exactly the drift the seed
 *      exists to correct — then a third run must re-add it (the seed's
 *      existing, unchanged behavior) AND bump the version (the fix): the
 *      failure mode this test exists to catch is the version staying flat
 *      here, which is exactly what happened before Fix 7.
 *
 * **Every assertion below is anchored to a measurement taken within this
 * test, never to an assumed clean starting point.** `test/integration/`
 * runs its files sequentially in one process against the SAME
 * `pharos_grc_test` database, and several other files legitimately plant
 * their own role fixtures there (scope/authorization tests) without
 * deleting them afterward — nothing resets the `role`/`permission` tables
 * between files, only once before the whole run. An earlier version of
 * this test compared a live `role.count()` taken here against
 * `firstRun.roleCount` (the seed's own fixed, hardcoded role-definition
 * size, `rolesByName.size` in `platform.seed.ts` — a constant, not a table
 * read) — true only when this file happens to run against a table
 * containing exactly the seed's own rows and nothing else. The moment any
 * earlier file in the same run left one extra role behind, that comparison
 * failed for a reason that has nothing to do with this fix (`expected 12
 * to be 10`, caught running the whole integration suite, never in
 * isolation). Fixed by comparing two LIVE counts taken back-to-back inside
 * this same test (immediately after the first run, and again after the
 * no-op second run) instead of one live count against a fixed constant —
 * true regardless of how many rows already existed when this test began.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { seedPlatform } from '../../prisma/seed/platform.seed';
import { AppConfigService } from '../../src/infrastructure/config/app-config.service';

import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

const PERMISSION_CACHE_STATE_ID = 'singleton';

describe('Seed permission-cache invalidation (Fix 7)', () => {
  let ctx: IntegrationTestContext;
  let appConfig: AppConfigService;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule();
    appConfig = ctx.app.get(AppConfigService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function readPermissionsVersion(): Promise<number> {
    const state = await ctx.prisma.client.permissionCacheState.findUniqueOrThrow({
      where: { id: PERMISSION_CACHE_STATE_ID },
      select: { permissionsVersion: true },
    });
    return state.permissionsVersion;
  }

  it('bumps the version on first seed, not again on an immediate no-op re-seed, and again once a role permission is deliberately removed and the seed restores it', async () => {
    // First run: whatever this shared database already holds when this
    // test starts, `reconcileRolePermissions` brings every system role to
    // its full, converged permission set — a real change for at least the
    // roles not already converged, so the version must move.
    const versionBeforeFirstRun = await readPermissionsVersion();
    const firstRun = await seedPlatform(ctx.prisma, appConfig);
    const versionAfterFirstRun = await readPermissionsVersion();
    expect(versionAfterFirstRun).toBeGreaterThan(versionBeforeFirstRun);

    // Live counts taken right after the first run — the baseline the
    // no-op check below compares against. Never compared to a fixed
    // constant (see the header comment): only to the equivalent live
    // count taken after the second run, a few lines down.
    const [permissionRowCountAfterFirstRun, roleRowCountAfterFirstRun] = await Promise.all([
      ctx.prisma.client.permission.count(),
      ctx.prisma.client.role.count(),
    ]);

    // Second run, immediately after: every role is already exactly
    // converged, so `reconcileRolePermissions` must find `toAdd`/`toRemove`
    // both empty for every role and bump nothing.
    const secondRun = await seedPlatform(ctx.prisma, appConfig);
    const versionAfterNoopRun = await readPermissionsVersion();
    expect(versionAfterNoopRun).toBe(versionAfterFirstRun);

    // Front E, step 4 (D-17/research.md): idempotence of the seed's OWN
    // reported counts — both are `rolesByName.size`/`permissionsByIdentifier
    // .size`, the seed's fixed, hardcoded definition sizes (never a table
    // read), so this proves the seed reports the same shape on both runs.
    // It does NOT prove the tables themselves gained no extra row — that is
    // the live-count delta below, which is the check that actually matters
    // here and the one this test previously got wrong.
    expect(secondRun.permissionCount).toBe(firstRun.permissionCount);
    expect(secondRun.roleCount).toBe(firstRun.roleCount);
    expect(secondRun.rootOrgUnitId).toBe(firstRun.rootOrgUnitId);
    expect(secondRun.adminUserId).toBe(firstRun.adminUserId);

    // Not merely "the seed's own return value agrees with itself" — assert
    // against the actual tables it should have left untouched by the
    // second (no-op) run. Anchored to the LIVE count taken right after the
    // FIRST run above, never to `firstRun.permissionCount`/`.roleCount`
    // (the seed's fixed definition sizes) — this shared database is not
    // guaranteed to hold only this seed's own rows (header comment), so
    // the only claim that survives ambient pollution from another file is
    // "the no-op run changed nothing", not "the table holds exactly N
    // rows".
    const [permissionRowCount, roleRowCount, rootOrgUnitRowCount, adminUserRowCount] =
      await Promise.all([
        ctx.prisma.client.permission.count(),
        ctx.prisma.client.role.count(),
        ctx.prisma.client.organizationalUnit.count({ where: { id: firstRun.rootOrgUnitId } }),
        ctx.prisma.client.user.count({ where: { id: firstRun.adminUserId } }),
      ]);
    expect(permissionRowCount).toBe(permissionRowCountAfterFirstRun);
    expect(roleRowCount).toBe(roleRowCountAfterFirstRun);
    expect(rootOrgUnitRowCount).toBe(1);
    expect(adminUserRowCount).toBe(1);

    // Force the EXACT drift the seed exists to correct: delete one
    // permission this seed run just gave "Risk Manager" directly from
    // `RolePermission`, bypassing the seed entirely.
    const riskManagerRole = await ctx.prisma.client.role.findUniqueOrThrow({
      where: { name: 'Risk Manager' },
      select: { id: true },
    });
    const riskViewPermission = await ctx.prisma.client.permission.findUniqueOrThrow({
      where: { identifier: 'risk:view' },
      select: { id: true },
    });
    await ctx.prisma.client.rolePermission.delete({
      where: {
        roleId_permissionId: { roleId: riskManagerRole.id, permissionId: riskViewPermission.id },
      },
    });
    const versionAfterManualDrift = await readPermissionsVersion();
    expect(versionAfterManualDrift).toBe(versionAfterNoopRun);

    // Third run: the seed's OWN definition still lists `risk:view` for
    // `Risk Manager`, so reconciliation re-adds it — proven first — AND
    // (the fix under test) bumps the version, so a caller with a warm
    // cache entry sees the restored permission on their very next request
    // rather than up to a full cache TTL later.
    await seedPlatform(ctx.prisma, appConfig);

    const restored = await ctx.prisma.client.rolePermission.findUnique({
      where: {
        roleId_permissionId: { roleId: riskManagerRole.id, permissionId: riskViewPermission.id },
      },
    });
    expect(restored).not.toBeNull();

    const versionAfterRestoreRun = await readPermissionsVersion();
    expect(versionAfterRestoreRun).toBeGreaterThan(versionAfterManualDrift);
  });
});
