/**
 * D-11 — every administrative endpoint refuses an UNAUTHENTICATED caller
 * with 401 (distinct from T172's `admin-permissions.spec.ts`, which proves
 * 403 for an authenticated caller lacking the permission). Same 22-endpoint
 * enumeration, no session cookie at all.
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface EndpointCase {
  readonly method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  readonly path: string;
}

const ENDPOINTS: readonly EndpointCase[] = [
  { method: 'get', path: '/api/v1/admin/users' },
  { method: 'post', path: '/api/v1/admin/users' },
  { method: 'get', path: `/api/v1/admin/users/${randomUUID()}` },
  { method: 'patch', path: `/api/v1/admin/users/${randomUUID()}` },
  { method: 'put', path: `/api/v1/admin/users/${randomUUID()}/status` },
  { method: 'put', path: `/api/v1/admin/users/${randomUUID()}/password` },
  { method: 'delete', path: `/api/v1/admin/users/${randomUUID()}/sessions` },
  { method: 'put', path: `/api/v1/admin/users/${randomUUID()}/roles` },
  { method: 'get', path: `/api/v1/admin/users/${randomUUID()}/scope-grants` },
  { method: 'post', path: `/api/v1/admin/users/${randomUUID()}/scope-grants` },
  { method: 'delete', path: `/api/v1/admin/users/${randomUUID()}/scope-grants/${randomUUID()}` },
  { method: 'get', path: '/api/v1/admin/roles' },
  { method: 'post', path: '/api/v1/admin/roles' },
  { method: 'get', path: `/api/v1/admin/roles/${randomUUID()}` },
  { method: 'patch', path: `/api/v1/admin/roles/${randomUUID()}` },
  { method: 'delete', path: `/api/v1/admin/roles/${randomUUID()}` },
  { method: 'get', path: '/api/v1/admin/permissions' },
  { method: 'get', path: '/api/v1/admin/org-units' },
  { method: 'post', path: '/api/v1/admin/org-units' },
  { method: 'get', path: `/api/v1/admin/org-units/${randomUUID()}` },
  { method: 'patch', path: `/api/v1/admin/org-units/${randomUUID()}` },
  { method: 'put', path: `/api/v1/admin/org-units/${randomUUID()}/status` },
];

describe('Administrative endpoints refuse an unauthenticated caller (D-11, US8)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it.each(ENDPOINTS)(
    'refuses $method $path with 401 when no session is presented',
    async ({ method, path }) => {
      const response = await request(ctx.app.getHttpServer())
        [method](path)
        .set('Origin', appOrigin)
        .send({});

      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.body as { status: number };
      expect(body.status).toBe(401);
    },
  );

  it('covers all 22 operations defined by contracts/admin.openapi.yaml', () => {
    expect(ENDPOINTS).toHaveLength(22);
  });
});
