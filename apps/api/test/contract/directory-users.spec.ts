/**
 * Gap-coverage — `GET /users` (`DirectoryUsersController.list`,
 * `contracts/admin.openapi.yaml` line ~40) had NO test anywhere in the
 * repository before this dispatch, found by the same systematic
 * route-vs-test cross-reference that surfaced the untested
 * `/risk-methodology` endpoints (see `risk-methodology.spec.ts`'s own
 * header comment). Requires only an authenticated session — no
 * administrative permission (`@NoPermissionRequired()`) — and returns the
 * `{data, meta}` envelope (T095b).
 *
 * The listing IS organizational-scope-filtered on `primaryOrgUnitId`
 * (`ListDirectoryUsersUseCase`'s own doc comment: "the coordinator's
 * inviolable rule ... applies FR-025's general principle to every user
 * listing"), even though the contract's own prose for this endpoint does
 * not mention scope — so the actor below is granted a `UNIT` scope
 * (unrelated to RBAC permissions) purely so the success assertions have
 * something deterministic to check against, not because the endpoint
 * requires any permission.
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture, createOrgUnitFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface UserRefBody {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

interface DirectoryPageBody {
  readonly data: readonly UserRefBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

interface ProblemBody {
  readonly status: number;
}

describe('GET /users — directory lookup (T095b, FR-058)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;
  let orgUnitId: string;
  let selfId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('directory-users-org'),
    });
    orgUnitId = orgUnit.id;

    // A real, logged-in user holding NO role and therefore NO permission at
    // all — the contract is explicit that `GET /users` requires "no
    // administrative permission". A `UNIT` scope grant (not a permission)
    // is still required for the listing to return anything at all.
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('directory-users-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });
    selfId = fixture.user.id;

    agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('succeeds for an authenticated user holding no administrative permission', async () => {
    const response = await agent.get('/api/v1/users').set('Origin', appOrigin);
    expect(response.status).toBe(200);
  });

  it('returns the {data, meta} envelope with meta carrying real pagination values, scoped to the org unit', async () => {
    const prisma = ctx.app.get(PrismaService);
    // A second user in the SAME scoped unit, so the listing has more than
    // just the caller to return.
    await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('directory-users-peer')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });

    const realTotal = await prisma.client.user.count({
      where: { status: 'ACTIVE', primaryOrgUnitId: orgUnitId },
    });

    const response = await agent
      .get('/api/v1/users')
      .query({ page: 1, pageSize: 100 })
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as DirectoryPageBody;

    // The envelope itself: `data`/`meta`, not `PageResponse`'s internal
    // `items`/flat fields.
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(body).not.toHaveProperty('items');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toEqual({
      page: 1,
      pageSize: 100,
      total: realTotal,
      totalPages: Math.ceil(realTotal / 100),
    });
    expect(realTotal).toBeGreaterThanOrEqual(2);

    expect(body.data.some((row) => row.id === selfId)).toBe(true);
    for (const row of body.data) {
      expect(row.id).toBeTruthy();
      expect(typeof row.fullName).toBe('string');
      expect(typeof row.email).toBe('string');
    }
  });

  it('excludes a user outside the caller’s organizational scope', async () => {
    const prisma = ctx.app.get(PrismaService);
    const outsideOrgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('directory-users-outside-org'),
    });
    const outsider = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('directory-users-outsider')}@example.test`,
      primaryOrgUnitId: outsideOrgUnit.id,
    });

    const response = await agent
      .get('/api/v1/users')
      .query({ page: 1, pageSize: 100 })
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as DirectoryPageBody;
    expect(body.data.some((row) => row.id === outsider.user.id)).toBe(false);
  });

  it('filters by q (case-insensitive match on full name or email) within scope', async () => {
    const prisma = ctx.app.get(PrismaService);
    const marker = uniqueTestMarker('directory-users-q');
    const fixture = await createLocalUserFixture(prisma, {
      email: `${marker}@example.test`,
      fullName: `Findable ${marker}`,
      primaryOrgUnitId: orgUnitId,
    });

    const response = await agent.get('/api/v1/users').query({ q: marker }).set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as DirectoryPageBody;
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.id).toBe(fixture.user.id);
  });

  it('refuses an unauthenticated caller with 401', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/v1/users');

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(401);
  });

  it('never discloses internal detail in the response (FR-107)', async () => {
    const response = await agent.get('/api/v1/users').set('Origin', appOrigin);
    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
    expect(raw).not.toMatch(/passwordHash/i);
  });
});

/**
 * `?assignableForOrgUnitId` — the F-34 fix itself: `GET /users` switching
 * from the BROWSE rule (above) to the ASSIGNMENT rule
 * (`ListDirectoryUsersUseCase`/`AssignmentLineService`). Builds a small
 * real tree — `root -> leaf` and `root -> sibling`, both children of
 * `root` — so "ancestor visible, sibling excluded" is proven against
 * actual materialized paths, not a mock.
 */
describe('GET /users?assignableForOrgUnitId — assignment lookup (F-34)', () => {
  /*
   * Searched for by e-mail rather than scanned out of an unfiltered page.
   *
   * These two assertions used to request `pageSize: 100` and look for the
   * fixture in the result. That passed while the shared contract database was
   * small and started failing once the suite grew: every spec file adds users
   * to the SAME database, which `global-setup.ts` truncates once per run and
   * never between files, so "the first 100 directory rows" stops containing a
   * specific fixture as the run gets longer. Exactly the assumption F-29
   * already recorded for the admin user list, reproduced here.
   *
   * Narrowing by the fixture's own unique marker makes the assertion
   * independent of how many users exist — which is what it was always trying
   * to say.
   */
  let ancestorOwnerEmail: string;
  let noUnitUserEmail: string;
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;
  let leafId: string;
  let siblingId: string;
  let ancestorOwnerId: string;
  let noUnitUserId: string;
  let siblingUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);

    // root -> leaf, root -> sibling (materialized-path convention: a
    // descendant's path extends its parent's path with its own id, exactly
    // as `org-units.spec.ts` already establishes for `expandToDescendants`).
    const root = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('assignment-line-root'),
    });

    const leafFixtureId = randomUUID();
    const leaf = await createOrgUnitFixture(prisma, {
      id: leafFixtureId,
      code: uniqueTestMarker('assignment-line-leaf'),
      parentId: root.id,
      path: `${root.path}${leafFixtureId}/`,
      depth: 1,
    });
    leafId = leaf.id;

    const siblingFixtureId = randomUUID();
    const sibling = await createOrgUnitFixture(prisma, {
      id: siblingFixtureId,
      code: uniqueTestMarker('assignment-line-sibling'),
      parentId: root.id,
      path: `${root.path}${siblingFixtureId}/`,
      depth: 1,
    });
    siblingId = sibling.id;

    // Owner whose primary unit is the ANCESTOR (`root`) of the leaf the
    // caller is scoped to — the exact real case the whole fix exists for.
    const ancestorOwnerEmailValue = `${uniqueTestMarker('assignment-line-ancestor-owner')}@example.test`;
    ancestorOwnerEmail = ancestorOwnerEmailValue;
    const ancestorOwner = await createLocalUserFixture(prisma, {
      email: ancestorOwnerEmailValue,
      primaryOrgUnitId: root.id,
    });
    ancestorOwnerId = ancestorOwner.user.id;

    // Active user recorded against NO organizational unit at all.
    const noUnitEmailValue = `${uniqueTestMarker('assignment-line-no-unit')}@example.test`;
    noUnitUserEmail = noUnitEmailValue;
    const noUnitUser = await createLocalUserFixture(prisma, {
      email: noUnitEmailValue,
    });
    noUnitUserId = noUnitUser.user.id;

    // F-CV-2 (`risks-lifecycle-audit`): the assignment lookup now also
    // filters by whether the candidate can SEE a risk in `leafId`
    // (`risk:view` + scope reaching it) — both of the fixtures above are
    // the ones this rule exists to accept (an ancestor's owner, a user with
    // no primary unit at all), so both need exactly that to keep being
    // returned; `siblingUser` below deliberately gets neither, since the
    // test it feeds asserts REFUSAL on assignment-line grounds already.
    const viewerRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-assignment-line-viewer-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: ancestorOwner.user, role: viewerRole });
    await grantUnitScopeFixture(prisma, { user: ancestorOwner.user, orgUnitId: leafId });
    await assignRoleFixture(prisma, { user: noUnitUser.user, role: viewerRole });
    await grantUnitScopeFixture(prisma, { user: noUnitUser.user, orgUnitId: leafId });

    // A user in the SIBLING branch — must never appear in the leaf's
    // assignment line.
    const siblingUser = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('assignment-line-sibling-user')}@example.test`,
      primaryOrgUnitId: siblingId,
    });
    siblingUserId = siblingUser.user.id;

    // The caller: scoped to the LEAF unit only (a `UNIT` grant on `leaf`,
    // which has no descendants of its own).
    const actor = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('assignment-line-actor')}@example.test`,
      primaryOrgUnitId: leafId,
    });
    await grantUnitScopeFixture(prisma, { user: actor.user, orgUnitId: leafId });

    agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: actor.user.email, password: actor.rawPassword });
    expect(loginResponse.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('returns a user whose primary unit is an ANCESTOR of the caller-scoped leaf — the F-34 case', async () => {
    const response = await agent
      .get('/api/v1/users')
      .query({ assignableForOrgUnitId: leafId, pageSize: 100, q: ancestorOwnerEmail })
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as DirectoryPageBody;
    expect(body.data.some((row) => row.id === ancestorOwnerId)).toBe(true);
  });

  it('returns an active user recorded against no organizational unit at all', async () => {
    const response = await agent
      .get('/api/v1/users')
      .query({ assignableForOrgUnitId: leafId, pageSize: 100, q: noUnitUserEmail })
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as DirectoryPageBody;
    expect(body.data.some((row) => row.id === noUnitUserId)).toBe(true);
  });

  it('does NOT return a user in a SIBLING branch', async () => {
    const response = await agent
      .get('/api/v1/users')
      .query({ assignableForOrgUnitId: leafId, pageSize: 100 })
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as DirectoryPageBody;
    expect(body.data.some((row) => row.id === siblingUserId)).toBe(false);
  });

  it('without the parameter, the same caller still gets the old browse behaviour — nothing widened by default', async () => {
    const response = await agent
      .get('/api/v1/users')
      .query({ pageSize: 100 })
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as DirectoryPageBody;
    // The browse rule filters `primaryOrgUnitId IN scope.unitIds` (just
    // `leaf` here — a `UNIT` grant with no descendants) and, unlike the
    // assignment rule, never admits `primaryOrgUnitId: null` either
    // (`IN (...)` never matches NULL) — both the ancestor owner and the
    // no-unit user must be ABSENT here, proving the assignment rule's
    // widening only ever applies when the parameter is present.
    expect(body.data.some((row) => row.id === ancestorOwnerId)).toBe(false);
    expect(body.data.some((row) => row.id === noUnitUserId)).toBe(false);
    expect(body.data.some((row) => row.id === siblingUserId)).toBe(false);
  });

  it('a unit outside the caller scope and a nonexistent unit refuse byte-identically (404)', async () => {
    const outOfScopeResponse = await agent
      .get('/api/v1/users')
      .query({ assignableForOrgUnitId: siblingId })
      .set('Origin', appOrigin);
    const nonexistentResponse = await agent
      .get('/api/v1/users')
      .query({ assignableForOrgUnitId: randomUUID() })
      .set('Origin', appOrigin);

    expect(outOfScopeResponse.status).toBe(404);
    expect(nonexistentResponse.status).toBe(404);
    const outOfScopeBody = outOfScopeResponse.body as {
      type: string;
      title: string;
      status: number;
    };
    const nonexistentBody = nonexistentResponse.body as {
      type: string;
      title: string;
      status: number;
    };
    expect(outOfScopeBody.title).toBe(nonexistentBody.title);
    expect(outOfScopeBody.status).toBe(nonexistentBody.status);
    expect(outOfScopeBody.type).toBe(nonexistentBody.type);
  });
});
