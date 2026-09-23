import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface ProblemBody {
  readonly status: number;
  readonly correlationId: string;
}

describe('Unauthenticated access (T050, FR-012/FR-015)', () => {
  let ctx: ContractTestContext;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('refuses GET /api/v1/auth/me with no session cookie at all', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(401);
    expect(body.correlationId).toBeDefined();
  });

  it('refuses GET /api/v1/auth/session with no session cookie', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/v1/auth/session');
    expect(response.status).toBe(401);
  });

  it('refuses GET /api/v1/auth/me with a garbage/unknown session cookie', async () => {
    const response = await request(ctx.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', 'pgrc_session=this-is-not-a-real-token');

    expect(response.status).toBe(401);
  });

  it('never discloses internal detail in the 401 body (FR-107)', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/v1/auth/me');

    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
    expect(raw).not.toMatch(/session_id|sessionid/i);
  });

  it('keeps /api/v1/health/live public with no session', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/v1/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('keeps /api/v1/health/ready public with no session', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/v1/health/ready');
    expect([200, 503]).toContain(response.status);
  });
});
