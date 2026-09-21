/**
 * S-01 (audit A6-F01, `MandatoryPasswordChangeGuard`) — the server-side
 * enforcement of `LocalCredential.mustChangePassword`, exercised end to end
 * over real HTTP against the real `AppModule` guard chain.
 *
 * Reproduces the audit's exact finding first (a user created via
 * `POST /admin/users` could call `GET /risks` normally without ever calling
 * `POST /auth/me/password`), then proves the fix: the same call now
 * refuses with the new `PASSWORD_CHANGE_REQUIRED` problem, the small
 * allowlist of routes the password-change flow itself needs keeps working
 * while the change is pending, and the business route succeeds again once
 * the password has actually been changed.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { User } from '@prisma/client';

const FIXTURE_PASSWORD = 'Fixture-Passw0rd!';
const ROTATED_PASSWORD = 'Fixture-Passw0rd!-Rotated';

describe('Mandatory password change is enforced by the server (S-01, A6-F01)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let adminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    const prisma = ctx.app.get(PrismaService);

    const marker = uniqueTestMarker('fix-f02');
    const adminRole = await createRoleWithPermissionsFixture(prisma, ['user:administer'], {
      name: `${marker}-admin-role`,
    });
    const admin = await createLocalUserFixture(prisma, { email: `${marker}-admin@example.local` });
    await assignRoleFixture(prisma, { user: admin.user, role: adminRole });

    adminAgent = request.agent(ctx.app.getHttpServer());
    const login = await adminAgent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: admin.user.email, password: admin.rawPassword });
    expect(login.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('refuses GET /risks with PASSWORD_CHANGE_REQUIRED while pending, allows it after the change — and the small allowlist works throughout', async () => {
    const prisma = ctx.app.get(PrismaService);
    const marker = uniqueTestMarker('fix-f02');
    const email = `fix-f2-${marker}@example.local`;

    // `risk:view` + GLOBAL scope granted UP FRONT, via direct fixtures (not
    // the admin API — role assignment is a separate concern from S-01) —
    // so the "200 after the change" assertion below proves the business
    // route itself works once the guard steps aside, not that permission
    // was ever the reason for the earlier refusal.
    const riskViewerRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `${marker}-risk-viewer-role`,
    });

    const created = await adminAgent.post('/api/v1/admin/users').set('Origin', appOrigin).send({
      email,
      fullName: 'F2 Regression Fixture',
      initialPassword: FIXTURE_PASSWORD,
    });
    expect(created.status).toBe(201);
    const userId = (created.body as { id: string }).id;

    const createdUserRef = { id: userId } as User;
    await assignRoleFixture(prisma, { user: createdUserRef, role: riskViewerRole });
    await grantGlobalScopeFixture(prisma, { user: createdUserRef });

    const userAgent = request.agent(ctx.app.getHttpServer());
    const login = await userAgent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password: FIXTURE_PASSWORD });
    expect(login.status).toBe(200);
    expect((login.body as { mustChangePassword: boolean }).mustChangePassword).toBe(true);

    // The exact audit reproduction (A6-F01): a business route, called
    // directly, while `mustChangePassword` is still `true`.
    const refused = await userAgent.get('/api/v1/risks').set('Origin', appOrigin);
    expect(refused.status).toBe(403);
    const refusedBody = refused.body as { type?: string; title?: string };
    expect(refusedBody.type).toMatch(/\/password-change-required$/);
    expect(refusedBody.title).toBe('Troca de senha obrigatória');

    // The allowlist: own session/profile still work while the change is
    // pending — these are exactly what the password-change screen itself
    // needs to function.
    const session = await userAgent.get('/api/v1/auth/session').set('Origin', appOrigin);
    expect(session.status).toBe(200);
    const me = await userAgent.get('/api/v1/auth/me').set('Origin', appOrigin);
    expect(me.status).toBe(200);

    // Completing the change revokes the session (existing FR-017 behaviour,
    // unrelated to S-01) — the client must sign in again afterward.
    const changePassword = await userAgent
      .post('/api/v1/auth/me/password')
      .set('Origin', appOrigin)
      .send({ currentPassword: FIXTURE_PASSWORD, newPassword: ROTATED_PASSWORD });
    expect(changePassword.status).toBe(204);

    const reLogin = await userAgent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password: ROTATED_PASSWORD });
    expect(reLogin.status).toBe(200);
    expect((reLogin.body as { mustChangePassword: boolean }).mustChangePassword).toBe(false);

    // The exact same business route the audit reproduced against — now
    // succeeds, because the guard steps aside once the change is done.
    const allowed = await userAgent.get('/api/v1/risks').set('Origin', appOrigin);
    expect(allowed.status).toBe(200);
  });

  it('allows POST /auth/logout while a password change is pending', async () => {
    const marker = uniqueTestMarker('fix-f2-logout');
    const email = `fix-f2-${marker}@example.local`;

    const created = await adminAgent.post('/api/v1/admin/users').set('Origin', appOrigin).send({
      email,
      fullName: 'F2 Logout Fixture',
      initialPassword: FIXTURE_PASSWORD,
    });
    expect(created.status).toBe(201);

    const userAgent = request.agent(ctx.app.getHttpServer());
    const login = await userAgent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password: FIXTURE_PASSWORD });
    expect(login.status).toBe(200);
    expect((login.body as { mustChangePassword: boolean }).mustChangePassword).toBe(true);

    const logout = await userAgent.post('/api/v1/auth/logout').set('Origin', appOrigin);
    expect(logout.status).toBe(204);

    // The session is genuinely gone afterward — logout is not silently
    // exempted from ALSO actually terminating the session.
    const afterLogout = await userAgent.get('/api/v1/auth/session').set('Origin', appOrigin);
    expect(afterLogout.status).toBe(401);
  });

  it('does not refuse a @Public() route for a pending-change caller (login itself)', async () => {
    // Sanity check on the guard's own bypass: `@Public()` routes never even
    // reach a session to check. Login has no session yet, so this is really
    // asserting the guard does not somehow interfere with the one route
    // that must always work regardless of any account's password state.
    const marker = uniqueTestMarker('fix-f2-public');
    const email = `fix-f2-${marker}@example.local`;

    const created = await adminAgent.post('/api/v1/admin/users').set('Origin', appOrigin).send({
      email,
      fullName: 'F2 Public Route Fixture',
      initialPassword: FIXTURE_PASSWORD,
    });
    expect(created.status).toBe(201);

    const login = await request
      .agent(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password: FIXTURE_PASSWORD });
    expect(login.status).toBe(200);
  });
});
