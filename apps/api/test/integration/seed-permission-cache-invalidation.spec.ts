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
    const versionBeforeFirstRun = await readPermissionsVersion();
    const firstRun = await seedPlatform(ctx.prisma, appConfig);
    const versionAfterFirstRun = await readPermissionsVersion();
    expect(versionAfterFirstRun).toBeGreaterThan(versionBeforeFirstRun);

    const [permissionRowCountAfterFirstRun, roleRowCountAfterFirstRun] = await Promise.all([
      ctx.prisma.client.permission.count(),
      ctx.prisma.client.role.count(),
    ]);

    const secondRun = await seedPlatform(ctx.prisma, appConfig);
    const versionAfterNoopRun = await readPermissionsVersion();
    expect(versionAfterNoopRun).toBe(versionAfterFirstRun);

    expect(secondRun.permissionCount).toBe(firstRun.permissionCount);
    expect(secondRun.roleCount).toBe(firstRun.roleCount);
    expect(secondRun.rootOrgUnitId).toBe(firstRun.rootOrgUnitId);
    expect(secondRun.adminUserId).toBe(firstRun.adminUserId);

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
