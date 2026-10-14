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

    const refused = await userAgent.get('/api/v1/risks').set('Origin', appOrigin);
    expect(refused.status).toBe(403);
    const refusedBody = refused.body as { type?: string; title?: string };
    expect(refusedBody.type).toMatch(/\/password-change-required$/);
    expect(refusedBody.title).toBe('Troca de senha obrigatória');

    const session = await userAgent.get('/api/v1/auth/session').set('Origin', appOrigin);
    expect(session.status).toBe(200);
    const me = await userAgent.get('/api/v1/auth/me').set('Origin', appOrigin);
    expect(me.status).toBe(200);

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

    const afterLogout = await userAgent.get('/api/v1/auth/session').set('Origin', appOrigin);
    expect(afterLogout.status).toBe(401);
  });

  it('does not refuse a @Public() route for a pending-change caller (login itself)', async () => {
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
