import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import {
  createLocalUserFixture,
  createOrgUnitFixture,
  createUserFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

describe('Admin organizational scope grant administration (T180, US8)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const role = await createRoleWithPermissionsFixture(prisma, ['user:administer'], {
      name: `fixture-admin-scope-admin-role-${randomUUID()}`,
    });
    const admin = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('asg-admin')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: admin.user, role });

    agent = request.agent(ctx.app.getHttpServer());
    const login = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: admin.user.email, password: admin.rawPassword });
    expect(login.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists an empty array for a user with no grants, 404 for a nonexistent user', async () => {
    const prisma = ctx.app.get(PrismaService);
    const target = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('asg-empty')}@example.test`,
    });

    const response = await agent
      .get(`/api/v1/admin/users/${target.id}/scope-grants`)
      .set('Origin', appOrigin);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);

    const notFound = await agent
      .get(`/api/v1/admin/users/${randomUUID()}/scope-grants`)
      .set('Origin', appOrigin);
    expect(notFound.status).toBe(404);
  });

  it('grants a UNIT scope with the declared OrgScopeGrant shape', async () => {
    const prisma = ctx.app.get(PrismaService);
    const target = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('asg-unit')}@example.test`,
    });
    const orgUnit = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('asg-org') });

    const response = await agent
      .post(`/api/v1/admin/users/${target.id}/scope-grants`)
      .set('Origin', appOrigin)
      .send({ scopeType: 'UNIT', orgUnitId: orgUnit.id });

    expect(response.status).toBe(201);
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({ scopeType: 'UNIT' });
    expect(body.orgUnit).toMatchObject({ id: orgUnit.id });
    expect(body.grantedBy).toMatchObject({ id: (await agentSelf()).id });

    async function agentSelf(): Promise<{ id: string }> {
      const me = await agent.get('/api/v1/auth/me').set('Origin', appOrigin);
      return me.body as { id: string };
    }
  });

  it('grants a GLOBAL scope with no orgUnit', async () => {
    const prisma = ctx.app.get(PrismaService);
    const target = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('asg-global')}@example.test`,
    });

    const response = await agent
      .post(`/api/v1/admin/users/${target.id}/scope-grants`)
      .set('Origin', appOrigin)
      .send({ scopeType: 'GLOBAL' });

    expect(response.status).toBe(201);
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({ scopeType: 'GLOBAL' });
    expect(body.orgUnit).toBeNull();
  });

  it('refuses an inconsistent grant: UNIT without orgUnitId, and GLOBAL with one (422)', async () => {
    const prisma = ctx.app.get(PrismaService);
    const target = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('asg-inconsistent')}@example.test`,
    });
    const orgUnit = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('asg-inc-org') });

    const unitWithoutOrgUnit = await agent
      .post(`/api/v1/admin/users/${target.id}/scope-grants`)
      .set('Origin', appOrigin)
      .send({ scopeType: 'UNIT' });
    expect(unitWithoutOrgUnit.status).toBe(422);

    const globalWithOrgUnit = await agent
      .post(`/api/v1/admin/users/${target.id}/scope-grants`)
      .set('Origin', appOrigin)
      .send({ scopeType: 'GLOBAL', orgUnitId: orgUnit.id });
    expect(globalWithOrgUnit.status).toBe(422);
  });

  it('refuses a UNIT grant for a nonexistent organizational unit (422)', async () => {
    const prisma = ctx.app.get(PrismaService);
    const target = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('asg-badunit')}@example.test`,
    });

    const response = await agent
      .post(`/api/v1/admin/users/${target.id}/scope-grants`)
      .set('Origin', appOrigin)
      .send({ scopeType: 'UNIT', orgUnitId: randomUUID() });
    expect(response.status).toBe(422);
  });

  it('refuses an identical duplicate grant (409)', async () => {
    const prisma = ctx.app.get(PrismaService);
    const target = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('asg-dup')}@example.test`,
    });
    const orgUnit = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('asg-dup-org') });

    const first = await agent
      .post(`/api/v1/admin/users/${target.id}/scope-grants`)
      .set('Origin', appOrigin)
      .send({ scopeType: 'UNIT', orgUnitId: orgUnit.id });
    expect(first.status).toBe(201);

    const second = await agent
      .post(`/api/v1/admin/users/${target.id}/scope-grants`)
      .set('Origin', appOrigin)
      .send({ scopeType: 'UNIT', orgUnitId: orgUnit.id });
    expect(second.status).toBe(409);
  });

  it('revokes a grant (204), 404 for a grant that does not belong to the named user', async () => {
    const prisma = ctx.app.get(PrismaService);
    const target = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('asg-revoke')}@example.test`,
    });
    const otherUser = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('asg-other')}@example.test`,
    });
    const orgUnit = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('asg-rev-org') });

    const created = await agent
      .post(`/api/v1/admin/users/${target.id}/scope-grants`)
      .set('Origin', appOrigin)
      .send({ scopeType: 'UNIT', orgUnitId: orgUnit.id });
    const grantId = (created.body as { id: string }).id;

    const wrongOwner = await agent
      .delete(`/api/v1/admin/users/${otherUser.id}/scope-grants/${grantId}`)
      .set('Origin', appOrigin);
    expect(wrongOwner.status).toBe(404);

    const revoked = await agent
      .delete(`/api/v1/admin/users/${target.id}/scope-grants/${grantId}`)
      .set('Origin', appOrigin);
    expect(revoked.status).toBe(204);

    const list = await agent
      .get(`/api/v1/admin/users/${target.id}/scope-grants`)
      .set('Origin', appOrigin);
    expect(list.body).toEqual([]);
  });
});
