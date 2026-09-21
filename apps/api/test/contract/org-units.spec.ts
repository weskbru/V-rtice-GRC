/**
 * D-11 gap-coverage — `GET /org-units` (`OrgUnitController.list`,
 * `contracts/admin.openapi.yaml` line ~78) had NO test anywhere in the
 * repository before this dispatch, found by the same coverage audit that
 * surfaced the untested `/risk-methodology` and `GET /users` endpoints (see
 * `risk-methodology.spec.ts`/`directory-users.spec.ts`'s own header
 * comments).
 *
 * The contract is explicit on two points this file proves independently:
 *
 *   1. "Requires an authenticated session; no administrative permission" —
 *      a zero-permission authenticated user must genuinely succeed.
 *   2. "Returns only units inside the caller's resolved organizational
 *      scope ... A caller holding a GLOBAL grant receives the whole tree."
 *      `ListOrgUnitsUseCase`/`PrismaOrgUnitDirectoryRepository`'s own doc
 *      comments claim this listing IS scope-filtered (`ScopedRepository`
 *      with `'id'` as the scope field, unioned with descendants via the
 *      materialized path) — this file verifies that claim against the real
 *      HTTP surface rather than trusting the comment.
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  grantGlobalScopeFixture,
  grantUnitScopeFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture, createOrgUnitFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface OrgUnitNodeBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: string;
  readonly childCount: number;
}

interface ProblemBody {
  readonly status: number;
}

describe('GET /org-units — organizational units within the caller scope (contracts/admin.openapi.yaml ~78)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function loginAs(
    email: string,
    password: string,
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password });
    expect(loginResponse.status).toBe(200);
    return agent;
  }

  it('succeeds for an authenticated user holding NO permission at all — the contract states "no administrative permission"', async () => {
    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('org-units-noperm-org'),
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('org-units-noperm')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    // No role, no permission at all — only a UNIT scope grant (a distinct
    // axis from RBAC permissions), so the listing has something
    // deterministic to return.
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });

    const agent = await loginAs(fixture.user.email, fixture.rawPassword);
    const response = await agent.get('/api/v1/org-units').set('Origin', appOrigin);

    expect(response.status).toBe(200);
  });

  it('refuses an unauthenticated caller with 401', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/v1/org-units');

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(401);
  });

  it('returns OrgUnitNode-shaped rows for a caller with a UNIT scope, and is genuinely scope-filtered: sees the granted unit and its descendant, but not a sibling tree outside the grant', async () => {
    const prisma = ctx.app.get(PrismaService);

    // A small tree: grantedParent -> grantedChild (both must be visible),
    // and a wholly separate outsideUnit (must NOT be visible) — proves
    // filtering, not merely that SOME array comes back.
    const grantedParent = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('org-units-scope-parent'),
    });
    const grantedChildId = randomUUID();
    const grantedChild = await createOrgUnitFixture(prisma, {
      id: grantedChildId,
      code: uniqueTestMarker('org-units-scope-child'),
      parentId: grantedParent.id,
      // Materialized-path prefix match (ADR-004): a descendant's path
      // extends its parent's path with its own id — the exact convention
      // `expandToDescendants` relies on (prisma-org-scope.repository.ts).
      path: `${grantedParent.path}${grantedChildId}/`,
      depth: 1,
    });
    const outsideUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('org-units-scope-outside'),
    });

    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('org-units-scoped-actor')}@example.test`,
      primaryOrgUnitId: grantedParent.id,
    });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: grantedParent.id });

    const agent = await loginAs(fixture.user.email, fixture.rawPassword);
    const response = await agent.get('/api/v1/org-units').set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as readonly OrgUnitNodeBody[];
    expect(Array.isArray(body)).toBe(true);

    const ids = body.map((node) => node.id);
    expect(ids).toContain(grantedParent.id);
    expect(ids).toContain(grantedChild.id);
    expect(ids).not.toContain(outsideUnit.id);

    // OrgUnitNode shape (contracts/admin.openapi.yaml): required
    // [id, code, name, depth, status].
    for (const node of body) {
      expect(typeof node.id).toBe('string');
      expect(typeof node.code).toBe('string');
      expect(typeof node.name).toBe('string');
      expect(typeof node.depth).toBe('number');
      expect(['ACTIVE', 'INACTIVE']).toContain(node.status);
      expect(typeof node.childCount).toBe('number');
    }
  });

  it('a caller with a GLOBAL scope grant receives the whole tree, including a unit no UNIT grant names', async () => {
    const prisma = ctx.app.get(PrismaService);
    const someUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('org-units-global-someunit'),
    });
    const anotherUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('org-units-global-anotherunit'),
    });

    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('org-units-global-actor')}@example.test`,
    });
    await grantGlobalScopeFixture(prisma, { user: fixture.user });

    const agent = await loginAs(fixture.user.email, fixture.rawPassword);
    const response = await agent.get('/api/v1/org-units').set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as readonly OrgUnitNodeBody[];
    const ids = body.map((node) => node.id);
    expect(ids).toContain(someUnit.id);
    expect(ids).toContain(anotherUnit.id);
  });

  it('excludes a caller with no OrgScopeGrant at all (deny-by-default, FR-025)', async () => {
    const prisma = ctx.app.get(PrismaService);
    const someUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('org-units-nogrant-someunit'),
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('org-units-nogrant-actor')}@example.test`,
    });
    // Deliberately NO grantUnitScopeFixture/grantGlobalScopeFixture call.

    const agent = await loginAs(fixture.user.email, fixture.rawPassword);
    const response = await agent.get('/api/v1/org-units').set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as readonly OrgUnitNodeBody[];
    expect(body).toEqual([]);
    // Not a coincidental empty page - the unit really exists.
    const exists = await prisma.client.organizationalUnit.findUnique({
      where: { id: someUnit.id },
    });
    expect(exists).not.toBeNull();
  });
});
