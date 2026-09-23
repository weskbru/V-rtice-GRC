import { UserStatus } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture, type LocalUserFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface AuthenticatedIdentityBody {
  readonly user: { readonly email: string };
  readonly permissions: readonly string[];
  readonly scope: { readonly global: boolean; readonly orgUnitIds: readonly string[] };
  readonly session: { readonly authenticationMethod: string };
  readonly mustChangePassword: boolean;
}

interface ProblemBody {
  readonly detail: string;
  readonly title: string;
  readonly type: string;
}

describe('POST /api/v1/auth/login (T051, FR-003, FR-007, FR-012, FR-019)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let cookieName: string;
  let fixture: LocalUserFixture;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;
    cookieName = appConfig.session.cookieName;

    const prisma = ctx.app.get(PrismaService);
    fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('login-contract')}@example.test`,
    });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('authenticates with correct credentials, sets the session cookie, and matches AuthenticatedIdentity', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });

    expect(response.status).toBe(200);

    const setCookie: unknown = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieHeaders = (Array.isArray(setCookie) ? setCookie : [setCookie]) as readonly string[];
    const cookieHeader = cookieHeaders.find((c) => c.startsWith(`${cookieName}=`));
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toMatch(/HttpOnly/i);
    expect(cookieHeader).toMatch(/SameSite=Lax/i);
    expect(cookieHeader).toMatch(/Path=\//i);
    const rawToken = /=([^;]+)/.exec(cookieHeader ?? '')?.[1] ?? '';
    expect(rawToken.length).toBeGreaterThan(20);
    expect(rawToken).not.toContain('.');

    const body = response.body as AuthenticatedIdentityBody;
    expect(body.user.email.toLowerCase()).toBe(fixture.user.email.toLowerCase());
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(Array.isArray(body.permissions)).toBe(true);
    expect(body.scope).toHaveProperty('global');
    expect(body.scope).toHaveProperty('orgUnitIds');
    expect(body.session).toHaveProperty('authenticationMethod', 'LOCAL');
    expect(body).toHaveProperty('mustChangePassword', false);
    expect(body.session).not.toHaveProperty('id');
    expect(JSON.stringify(body.session)).not.toMatch(/"id"/i);
  });

  it('allows the full authenticated flow with the issued cookie: /auth/me, /auth/session, then /auth/logout revokes it (T050, T067)', async () => {
    const agent = request.agent(ctx.app.getHttpServer());

    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    const meResponse = await agent.get('/api/v1/auth/me');
    expect(meResponse.status).toBe(200);
    expect((meResponse.body as { email: string }).email.toLowerCase()).toBe(
      fixture.user.email.toLowerCase(),
    );

    const sessionResponse = await agent.get('/api/v1/auth/session');
    expect(sessionResponse.status).toBe(200);

    const logoutResponse = await agent.post('/api/v1/auth/logout').set('Origin', appOrigin);
    expect(logoutResponse.status).toBe(204);

    const afterLogoutResponse = await agent.get('/api/v1/auth/me');
    expect(afterLogoutResponse.status).toBe(401);
  });

  it('refuses a wrong password with a generic 401 message', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: 'definitely-the-wrong-password' });

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).not.toHaveProperty('set-cookie');
  });

  it('returns the SAME generic message for an unknown account as for a wrong password (FR-007)', async () => {
    const unknownResponse = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({
        email: `${uniqueTestMarker('unknown')}@example.test`,
        password: 'whatever-password-123',
      });

    const wrongPasswordResponse = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: 'still-the-wrong-password' });

    expect(unknownResponse.status).toBe(401);
    expect(wrongPasswordResponse.status).toBe(401);
    const unknownBody = unknownResponse.body as ProblemBody;
    const wrongPasswordBody = wrongPasswordResponse.body as ProblemBody;
    expect(unknownBody.detail).toBe(wrongPasswordBody.detail);
    expect(unknownBody.title).toBe(wrongPasswordBody.title);
    expect(unknownBody.type).toBe(wrongPasswordBody.type);
  });

  it('returns the SAME generic message for a deactivated account as for a wrong password (FR-007, FR-011)', async () => {
    const prisma = ctx.app.get(PrismaService);
    const deactivated = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('deactivated-login')}@example.test`,
      status: UserStatus.INACTIVE,
    });

    const deactivatedResponse = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: deactivated.user.email, password: deactivated.rawPassword });

    const wrongPasswordResponse = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: 'still-the-wrong-password' });

    expect(deactivatedResponse.status).toBe(401);
    expect((deactivatedResponse.body as ProblemBody).detail).toBe(
      (wrongPasswordResponse.body as ProblemBody).detail,
    );
  });

  it('rejects a structurally invalid request body with 400', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: 'not-an-email', password: '' });

    expect(response.status).toBe(400);
  });

  it('rejects an unknown extra property with 400 (whitelist/forbidNonWhitelisted, FR-106)', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword, isAdmin: true });

    expect(response.status).toBe(400);
  });
});
