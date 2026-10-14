import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GetRolesSummaryUseCase } from '../../src/core/authorization/application/get-roles-summary.usecase';
import { PermissionResolverService } from '../../src/core/authorization/application/permission-resolver.service';
import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { buildContractTestApp, type ContractTestContext } from '../contract/support/contract-app';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createLocalUserFixture, createUserFixture } from './support/fixtures';

const SUMMARY_PATH = '/api/v1/admin/roles/summary';

interface RolesSummaryBody {
  readonly totalRoles: number;
  readonly systemRoles: number;
  readonly customRoles: number;
  readonly usersWithRoles: number;
}

describe('GET /admin/roles/summary (015, FR-039 to FR-041)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let prisma: PrismaService;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    prisma = ctx.app.get(PrismaService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function loginAs(
    email: string,
    rawPassword: string,
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(ctx.app.getHttpServer());
    const login = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password: rawPassword });
    expect(login.status).toBe(200);
    return agent;
  }

  async function createAdminAgent(marker: string): Promise<ReturnType<typeof request.agent>> {
    const role = await createRoleWithPermissionsFixture(prisma, ['role:administer'], {
      name: `fixture-${marker}-role-${randomUUID()}`,
    });
    const admin = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker(marker)}@example.test`,
    });
    await assignRoleFixture(prisma, { user: admin.user, role });
    return loginAs(admin.user.email, admin.rawPassword);
  }

  async function readSummary(agent: ReturnType<typeof request.agent>): Promise<RolesSummaryBody> {
    const response = await agent.get(SUMMARY_PATH).set('Origin', appOrigin);
    expect(response.status).toBe(200);
    return response.body as RolesSummaryBody;
  }

  it('answers 200 to a caller holding role:administer — and the route resolves as "summary", not as a role id', async () => {
    const agent = await createAdminAgent('rolesum-authorized');

    const response = await agent.get(SUMMARY_PATH).set('Origin', appOrigin);

    expect(response.status).not.toBe(400);
    expect(response.status).toBe(200);

    const body = response.body as RolesSummaryBody;
    expect(Object.keys(body).sort()).toEqual([
      'customRoles',
      'systemRoles',
      'totalRoles',
      'usersWithRoles',
    ]);
    for (const value of Object.values(body)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('answers 403 to an authenticated caller WITHOUT role:administer, and discloses no counts', async () => {
    const role = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-rolesum-denied-role-${randomUUID()}`,
    });
    const user = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('rolesum-denied')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: user.user, role });
    const agent = await loginAs(user.user.email, user.rawPassword);

    const response = await agent.get(SUMMARY_PATH).set('Origin', appOrigin);

    expect(response.status).toBe(403);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as Record<string, unknown>;
    expect(body.totalRoles).toBeUndefined();
    expect(body.usersWithRoles).toBeUndefined();
  });

  it('answers 401 with no session at all', async () => {
    const response = await request(ctx.app.getHttpServer())
      .get(SUMMARY_PATH)
      .set('Origin', appOrigin);

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('counts a person holding TWO roles exactly once (SC-004), while both roles count toward totalRoles', async () => {
    const agent = await createAdminAgent('rolesum-distinct');
    const before = await readSummary(agent);

    const firstRole = await createRoleWithPermissionsFixture(prisma, [], {
      name: `fixture-rolesum-distinct-a-${randomUUID()}`,
    });
    const secondRole = await createRoleWithPermissionsFixture(prisma, [], {
      name: `fixture-rolesum-distinct-b-${randomUUID()}`,
    });
    const person = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('rolesum-twohats')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: person, role: firstRole });
    await assignRoleFixture(prisma, { user: person, role: secondRole });

    const after = await readSummary(agent);

    expect(after.usersWithRoles - before.usersWithRoles).toBe(1);
    expect(after.totalRoles - before.totalRoles).toBe(2);
    expect(after.customRoles - before.customRoles).toBe(2);
    expect(after.systemRoles).toBe(before.systemRoles);

    const perRoleCounts = await Promise.all(
      [firstRole.id, secondRole.id].map((roleId) =>
        prisma.client.userRole.count({ where: { roleId } }),
      ),
    );
    expect(perRoleCounts).toEqual([1, 1]);
  });

  it('counts a SECOND person holding one of the same roles as a second distinct user', async () => {
    const agent = await createAdminAgent('rolesum-second');
    const role = await createRoleWithPermissionsFixture(prisma, [], {
      name: `fixture-rolesum-second-role-${randomUUID()}`,
    });

    const before = await readSummary(agent);
    const personA = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('rolesum-persona')}@example.test`,
    });
    const personB = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('rolesum-personb')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: personA, role });
    await assignRoleFixture(prisma, { user: personB, role });
    const after = await readSummary(agent);

    expect(after.usersWithRoles - before.usersWithRoles).toBe(2);
    expect(after.totalRoles).toBe(before.totalRoles);
  });

  it('holds totalRoles = systemRoles + customRoles against real, independently aggregated data', async () => {
    const agent = await createAdminAgent('rolesum-invariant');

    await prisma.client.role.create({
      data: {
        name: `fixture-rolesum-invariant-system-${randomUUID()}`,
        description: 'Fixture system role.',
        isSystem: true,
      },
    });
    await createRoleWithPermissionsFixture(prisma, [], {
      name: `fixture-rolesum-invariant-custom-${randomUUID()}`,
    });

    const summary = await readSummary(agent);

    expect(summary.systemRoles).toBeGreaterThan(0);
    expect(summary.customRoles).toBeGreaterThan(0);
    expect(summary.totalRoles).toBe(summary.systemRoles + summary.customRoles);
  });

  it('reports usersWithRoles = 0 when user_roles is genuinely empty', async () => {
    const useCase = ctx.app.get(GetRolesSummaryUseCase);
    const marker = 'rolesum-rollback-sentinel';

    let observed: RolesSummaryBody | undefined;
    await expect(
      prisma.runInTransaction(async () => {
        await prisma.client.userRole.deleteMany({});
        observed = await useCase.execute();
        throw new Error(marker);
      }),
    ).rejects.toThrow(marker);

    expect(observed?.usersWithRoles).toBe(0);
    expect(observed?.totalRoles).toBeGreaterThan(0);

    const survivingAssignments = await prisma.client.userRole.count();
    expect(survivingAssignments).toBeGreaterThan(0);
  });

  it('resolves a two-role user to the FLAT UNION of both permission sets — no inheritance, no transitive expansion', async () => {
    const resolver = ctx.app.get(PermissionResolverService);

    const roleA = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-rolesum-union-a-${randomUUID()}`,
    });
    const roleB = await createRoleWithPermissionsFixture(prisma, ['control:view'], {
      name: `fixture-rolesum-union-b-${randomUUID()}`,
    });
    await createRoleWithPermissionsFixture(prisma, ['role:administer'], {
      name: `fixture-rolesum-union-unheld-${randomUUID()}`,
    });

    const person = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('rolesum-union')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: person, role: roleA });
    await assignRoleFixture(prisma, { user: person, role: roleB });

    const effective = await resolver.getEffectivePermissions(person.id);

    expect(Array.from(effective).sort()).toEqual(['control:view', 'risk:view']);
    expect(effective.size).toBe(2);
    expect(await resolver.hasPermission(person.id, 'role:administer')).toBe(false);
  });

  it('adding a second role ADDS its permissions and removes none — union, never replacement or override', async () => {
    const resolver = ctx.app.get(PermissionResolverService);

    const roleA = await createRoleWithPermissionsFixture(prisma, ['risk:view', 'risk:create'], {
      name: `fixture-rolesum-additive-a-${randomUUID()}`,
    });
    const roleB = await createRoleWithPermissionsFixture(prisma, ['risk:view', 'control:view'], {
      name: `fixture-rolesum-additive-b-${randomUUID()}`,
    });
    const person = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('rolesum-additive')}@example.test`,
    });

    await assignRoleFixture(prisma, { user: person, role: roleA });
    const withOneRole = await resolver.getEffectivePermissions(person.id);
    expect(Array.from(withOneRole).sort()).toEqual(['risk:create', 'risk:view']);

    await assignRoleFixture(prisma, { user: person, role: roleB });
    await prisma.client.permissionCacheState.update({
      where: { id: 'singleton' },
      data: { permissionsVersion: { increment: 1 } },
    });

    const withTwoRoles = await resolver.getEffectivePermissions(person.id);

    expect(Array.from(withTwoRoles).sort()).toEqual(['control:view', 'risk:create', 'risk:view']);
  });
});
