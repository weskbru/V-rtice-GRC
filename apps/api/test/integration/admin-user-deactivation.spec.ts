import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { buildContractTestApp, type ContractTestContext } from '../contract/support/contract-app';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createLocalUserFixture } from './support/fixtures';

describe('Admin deactivation kills a live session (T176, FR-011, FR-017)', () => {
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

  it("revokes the target user's live session the moment an administrator deactivates them", async () => {
    const prisma = ctx.app.get(PrismaService);

    const adminRole = await createRoleWithPermissionsFixture(prisma, ['user:administer'], {
      name: `fixture-deact-admin-role-${uniqueTestMarker('x')}`,
    });
    const admin = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('deact-admin')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: admin.user, role: adminRole });

    const target = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('deact-target')}@example.test`,
    });

    const adminAgent = request.agent(ctx.app.getHttpServer());
    const adminLogin = await adminAgent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: admin.user.email, password: admin.rawPassword });
    expect(adminLogin.status).toBe(200);

    const targetAgent = request.agent(ctx.app.getHttpServer());
    const targetLogin = await targetAgent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: target.user.email, password: target.rawPassword });
    expect(targetLogin.status).toBe(200);

    const beforeMe = await targetAgent.get('/api/v1/auth/me').set('Origin', appOrigin);
    expect(beforeMe.status).toBe(200);

    const deactivateResponse = await adminAgent
      .put(`/api/v1/admin/users/${target.user.id}/status`)
      .set('Origin', appOrigin)
      .send({ status: 'INACTIVE', reason: 'Fixture: T176 admin deactivation test' });
    expect(deactivateResponse.status).toBe(200);

    const afterMe = await targetAgent.get('/api/v1/auth/me').set('Origin', appOrigin);
    expect(afterMe.status).toBe(401);

    const sessions = await prisma.client.session.findMany({ where: { userId: target.user.id } });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
    expect(sessions.every((session) => session.revokedReason === 'USER_DEACTIVATED')).toBe(true);

    const user = await prisma.client.user.findUnique({ where: { id: target.user.id } });
    expect(user?.status).toBe('INACTIVE');

    const auditRows = await prisma.client.auditEvent.findMany({
      where: { entityType: 'USER', entityId: target.user.id, action: 'user.deactivated' },
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.previousValues).toMatchObject({ status: 'ACTIVE' });
    expect(auditRows[0]!.newValues).toMatchObject({
      status: 'INACTIVE',
      reason: 'Fixture: T176 admin deactivation test',
    });
  });

  it('refuses a caller attempting to deactivate their own account with 422', async () => {
    const prisma = ctx.app.get(PrismaService);

    const adminRole = await createRoleWithPermissionsFixture(prisma, ['user:administer'], {
      name: `fixture-deact-self-role-${uniqueTestMarker('x')}`,
    });
    const admin = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('deact-self')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: admin.user, role: adminRole });

    const agent = request.agent(ctx.app.getHttpServer());
    const login = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: admin.user.email, password: admin.rawPassword });
    expect(login.status).toBe(200);

    const response = await agent
      .put(`/api/v1/admin/users/${admin.user.id}/status`)
      .set('Origin', appOrigin)
      .send({ status: 'INACTIVE' });

    expect(response.status).toBe(422);

    const me = await agent.get('/api/v1/auth/me').set('Origin', appOrigin);
    expect(me.status).toBe(200);
  });
});
