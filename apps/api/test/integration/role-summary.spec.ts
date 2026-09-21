/**
 * 2026-09-13 (015-roles-permissions-surface, T016/T017/T021) —
 * `GET /admin/roles/summary` against a real PostgreSQL and the real guard
 * chain (`SessionGuard` -> `PermissionGuard`), plus the model fact the new
 * screen is going to assert to the user in prose.
 *
 * Uses `buildContractTestApp` (the full `AppModule`, exactly as `main.ts`
 * wires it) for the same reason `permission-invalidation.spec.ts` does:
 * proving a permission outcome requires the real guard chain, which a
 * partial Nest testing module never assembles. Placed under
 * `test/integration/` per this phase's own task sheet (T016/T017); the two
 * vitest projects differ only in their `include` glob.
 *
 * ## Why nothing here asserts an absolute count
 *
 * `global-setup.ts` truncates the mutable tables ONCE before the whole run,
 * not between spec files, and this suite runs single-fork with file
 * parallelism off — so by the time this file executes, dozens of other spec
 * files have left their own roles and assignments behind. Every assertion
 * below is therefore a DELTA measured across a change this test itself
 * makes, or an invariant that holds at any population. An absolute
 * expectation (`totalRoles === 3`) would pass alone and fail in the suite,
 * which is worse than no test at all.
 *
 * The one genuinely absolute claim — "no assignments at all yields zero" —
 * is made inside a transaction that empties `user_roles` and is then rolled
 * back, so it observes a real empty table without destroying the run.
 *
 * ## Test marker prefixes
 *
 * `uniqueTestMarker` appends a 36-character UUID. F-45/F-54: a prefix of
 * EXACTLY two characters produces a 43-character marker, which matches the
 * session-token pattern `information-disclosure.spec.ts` scans for and
 * produces a false leak report. Every prefix here is longer.
 */
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

  /** Logs a fresh user in and returns their agent. */
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

  // -------------------------------------------------------------------
  // T017 — authorization, through the real guard chain
  // -------------------------------------------------------------------

  it('answers 200 to a caller holding role:administer — and the route resolves as "summary", not as a role id', async () => {
    const agent = await createAdminAgent('rolesum-authorized');

    const response = await agent.get(SUMMARY_PATH).set('Origin', appOrigin);

    // A 400 here would be the route-order defect: `summary` captured by
    // `:roleId` and refused by `ParseUUIDPipe`. Asserted explicitly so the
    // failure names the cause (`test/unit/admin-roles-route-order.spec.ts`
    // is the same guard, cheaper and without a database).
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
    // A real, catalogued permission that is not `role:administer` — a
    // caller with SOME permission, not a caller with none, so this proves
    // the endpoint's own gate rather than "unauthenticated users are
    // refused".
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

  // -------------------------------------------------------------------
  // T016 / SC-004 — usersWithRoles is a DISTINCT count
  // -------------------------------------------------------------------

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

    // ONE new person, TWO new assignments: the whole point of SC-004.
    // Summing `assignedUserCount` over roles would have moved this by 2.
    expect(after.usersWithRoles - before.usersWithRoles).toBe(1);
    expect(after.totalRoles - before.totalRoles).toBe(2);
    expect(after.customRoles - before.customRoles).toBe(2);
    expect(after.systemRoles).toBe(before.systemRoles);

    // And the per-role number this endpoint deliberately does NOT sum is
    // genuinely 1 on each of the two roles — i.e. the delta of 1 above is
    // a distinct count, not an accident of both roles reporting 0.
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
    // No new role was created in between.
    expect(after.totalRoles).toBe(before.totalRoles);
  });

  it('holds totalRoles = systemRoles + customRoles against real, independently aggregated data', async () => {
    const agent = await createAdminAgent('rolesum-invariant');

    // A system role and a custom role created here, so the invariant is
    // asserted over a population that genuinely contains both kinds
    // (`PrismaRoleRepository.create` forces `isSystem: false`, so the
    // system one is written directly).
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
    // Observed inside a transaction that empties the table and is then
    // rolled back: `PrismaService.runInTransaction` publishes the
    // transaction client on `AsyncLocalStorage`, and
    // `PrismaRoleRepository` reads `prisma.client` — so the use case
    // called from inside this block genuinely queries the emptied table,
    // and the `ROLLBACK` puts every row back for the rest of the run.
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
    // Roles themselves were untouched by the deletion, so this is a real
    // "assignments empty", not "database empty".
    expect(observed?.totalRoles).toBeGreaterThan(0);

    // The rollback really happened: assignments made by earlier tests in
    // this file are still there.
    const survivingAssignments = await prisma.client.userRole.count();
    expect(survivingAssignments).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------
  // T021 / plan.md §3 scenario 9 — no inheritance between roles
  // -------------------------------------------------------------------

  it('resolves a two-role user to the FLAT UNION of both permission sets — no inheritance, no transitive expansion', async () => {
    // This registers, in a test, the model fact the new screen states in
    // prose (FR-015): permissions are granted directly by a role, roles do
    // not contain or extend one another, and a person's effective access
    // is the union of the roles assigned to THEM. Proved against the real
    // schema and the real resolver, because that is the layer where a
    // recursive expansion would have to exist to exist at all — a stubbed
    // repository could only prove that the resolver unions whatever it is
    // handed.
    const resolver = ctx.app.get(PermissionResolverService);

    const roleA = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-rolesum-union-a-${randomUUID()}`,
    });
    const roleB = await createRoleWithPermissionsFixture(prisma, ['control:view'], {
      name: `fixture-rolesum-union-b-${randomUUID()}`,
    });
    // A third role the person does NOT hold, carrying a permission neither
    // of theirs does. If any containment/inheritance existed anywhere, a
    // role holding an administering permission would be the likeliest
    // place for it to leak from.
    await createRoleWithPermissionsFixture(prisma, ['role:administer'], {
      name: `fixture-rolesum-union-unheld-${randomUUID()}`,
    });

    const person = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('rolesum-union')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: person, role: roleA });
    await assignRoleFixture(prisma, { user: person, role: roleB });

    const effective = await resolver.getEffectivePermissions(person.id);

    // Exactly the union — asserted as a complete set, not with
    // `toContain`: "nothing else came along" is the whole claim.
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
    // `UserRole` rows changed, so the cached entry must not be trusted —
    // the production path bumps `permissionsVersion` through
    // `RoleAdminService`; this test writes the row directly via a fixture,
    // so it bumps the counter the same way that service would.
    await prisma.client.permissionCacheState.update({
      where: { id: 'singleton' },
      data: { permissionsVersion: { increment: 1 } },
    });

    const withTwoRoles = await resolver.getEffectivePermissions(person.id);

    // `risk:view` appears in BOTH roles and still appears once: the union
    // is de-duplicated, not doubled — and nothing from role A was lost.
    expect(Array.from(withTwoRoles).sort()).toEqual(['control:view', 'risk:create', 'risk:view']);
  });
});
