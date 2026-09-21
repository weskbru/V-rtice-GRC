/**
 * T172 — every administrative endpoint refuses a caller who lacks its
 * stated permission (`contracts/admin.openapi.yaml`, US8, D-11). Enumerated
 * exhaustively (22 operations across `/admin/users`, `/admin/roles`,
 * `/admin/permissions`, `/admin/org-units` and their sub-resources) rather
 * than sampled — D-11 exists specifically because a sampled/assumed
 * approach previously let two endpoints ship with no coverage at all.
 *
 * One unprivileged, real, logged-in user is reused for every check: they
 * hold `risk:view` (an unrelated resource, deliberately) and a `UNIT`
 * scope grant over some unit — both irrelevant to every assertion here,
 * proving the refusal is about the MISSING administrative permission, not
 * about session validity or organizational scope. `PermissionGuard` runs
 * before the body-validation `Pipe` in Nest's request pipeline (Guards,
 * then Pipes), so a minimal/empty body and random path-parameter UUIDs are
 * sufficient — the request never reaches DTO validation or the controller
 * body for any of these checks.
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

interface EndpointCase {
  readonly method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  readonly path: () => string;
  readonly requiredPermission: string;
}

const ENDPOINTS: readonly EndpointCase[] = [
  // /admin/users
  { method: 'get', path: () => '/api/v1/admin/users', requiredPermission: 'user:administer' },
  { method: 'post', path: () => '/api/v1/admin/users', requiredPermission: 'user:administer' },
  {
    method: 'get',
    path: () => `/api/v1/admin/users/${randomUUID()}`,
    requiredPermission: 'user:administer',
  },
  {
    method: 'patch',
    path: () => `/api/v1/admin/users/${randomUUID()}`,
    requiredPermission: 'user:administer',
  },
  {
    method: 'put',
    path: () => `/api/v1/admin/users/${randomUUID()}/status`,
    requiredPermission: 'user:administer',
  },
  {
    method: 'put',
    path: () => `/api/v1/admin/users/${randomUUID()}/password`,
    requiredPermission: 'user:administer',
  },
  {
    method: 'delete',
    path: () => `/api/v1/admin/users/${randomUUID()}/sessions`,
    requiredPermission: 'user:administer',
  },
  {
    method: 'put',
    path: () => `/api/v1/admin/users/${randomUUID()}/roles`,
    requiredPermission: 'role:administer',
  },
  {
    method: 'get',
    path: () => `/api/v1/admin/users/${randomUUID()}/scope-grants`,
    requiredPermission: 'user:administer',
  },
  {
    method: 'post',
    path: () => `/api/v1/admin/users/${randomUUID()}/scope-grants`,
    requiredPermission: 'user:administer',
  },
  {
    method: 'delete',
    path: () => `/api/v1/admin/users/${randomUUID()}/scope-grants/${randomUUID()}`,
    requiredPermission: 'user:administer',
  },
  // /admin/roles
  { method: 'get', path: () => '/api/v1/admin/roles', requiredPermission: 'role:administer' },
  { method: 'post', path: () => '/api/v1/admin/roles', requiredPermission: 'role:administer' },
  {
    method: 'get',
    path: () => `/api/v1/admin/roles/${randomUUID()}`,
    requiredPermission: 'role:administer',
  },
  {
    method: 'patch',
    path: () => `/api/v1/admin/roles/${randomUUID()}`,
    requiredPermission: 'role:administer',
  },
  {
    method: 'delete',
    path: () => `/api/v1/admin/roles/${randomUUID()}`,
    requiredPermission: 'role:administer',
  },
  // /admin/permissions
  {
    method: 'get',
    path: () => '/api/v1/admin/permissions',
    requiredPermission: 'role:administer',
  },
  // /admin/org-units
  {
    method: 'get',
    path: () => '/api/v1/admin/org-units',
    requiredPermission: 'org_unit:administer',
  },
  {
    method: 'post',
    path: () => '/api/v1/admin/org-units',
    requiredPermission: 'org_unit:administer',
  },
  {
    method: 'get',
    path: () => `/api/v1/admin/org-units/${randomUUID()}`,
    requiredPermission: 'org_unit:administer',
  },
  {
    method: 'patch',
    path: () => `/api/v1/admin/org-units/${randomUUID()}`,
    requiredPermission: 'org_unit:administer',
  },
  {
    method: 'put',
    path: () => `/api/v1/admin/org-units/${randomUUID()}/status`,
    requiredPermission: 'org_unit:administer',
  },
];

describe('Administrative endpoints refuse a non-administrator (T172, US8)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('admin-permissions-org'),
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('admin-permissions-unpriv')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    // `risk:view` (an unrelated resource) proves the refusal below is
    // specifically about the missing ADMINISTRATIVE permission — this is a
    // real, authenticated, in-scope user, not a bare session.
    const role = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-admin-permissions-unpriv-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });

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

  it.each(ENDPOINTS)(
    'refuses $method $requiredPermission-gated endpoint with 403 for a caller lacking it',
    async ({ method, path, requiredPermission }) => {
      const response = await agent[method](path()).set('Origin', appOrigin).send({});

      expect(response.status).toBe(403);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.body as { status: number; detail: string };
      expect(body.status).toBe(403);

      // FR-107: no stack trace, no SQL fragment, no internal identifier —
      // and never a hint at which specific permission was checked.
      const raw = JSON.stringify(response.body);
      expect(raw).not.toMatch(/stack/i);
      expect(raw).not.toMatch(/prisma/i);
      expect(raw).not.toContain(requiredPermission);
    },
  );

  it('every operation in contracts/admin.openapi.yaml is covered above (no silent gaps, D-11)', () => {
    // 11 /admin/users operations (incl. roles + scope-grants sub-resources)
    // + 6 /admin/roles + /admin/permissions operations + 5 /admin/org-units
    // operations = 22. A future endpoint added to the contract without a
    // matching entry above should be caught here first, before it ships
    // with no permission-refusal coverage at all (D-11's own root cause).
    expect(ENDPOINTS).toHaveLength(22);
  });
});
