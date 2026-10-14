import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RoleAdminService } from '../../src/core/authorization/application/role-admin.service';
import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { buildContractTestApp, type ContractTestContext } from '../contract/support/contract-app';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import {
  createLocalUserFixture,
  createOrgUnitFixture,
  createUserFixture,
} from './support/fixtures';

describe('Permission-version invalidation applies on the next request (T173, FR-028)', () => {
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

  it('a user holding org_unit:administer loses access to GET /admin/org-units the moment the role is stripped of it — same session, no re-login', async () => {
    const prisma = ctx.app.get(PrismaService);
    const roleAdmin = ctx.app.get(RoleAdminService);

    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('perm-org'),
    });
    const platformActor = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('pi-actor')}@example.test`,
    });

    const role = await createRoleWithPermissionsFixture(prisma, ['org_unit:administer'], {
      name: `fixture-pi-role-${randomUUID()}`,
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('pi-subj')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    const beforeResponse = await agent.get('/api/v1/admin/org-units').set('Origin', appOrigin);
    expect(beforeResponse.status).toBe(200);

    await roleAdmin.update({
      actorUserId: platformActor.id,
      roleId: role.id,
      permissionIdentifiers: [],
    });

    const afterResponse = await agent.get('/api/v1/admin/org-units').set('Origin', appOrigin);
    expect(afterResponse.status).toBe(403);
    expect(afterResponse.headers['content-type']).toContain('application/problem+json');
  });

  it('restoring the permission makes the SAME session succeed again on its very next request', async () => {
    const prisma = ctx.app.get(PrismaService);
    const roleAdmin = ctx.app.get(RoleAdminService);

    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('pi-r-org'),
    });
    const platformActor = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('pi-r-actor')}@example.test`,
    });
    const role = await createRoleWithPermissionsFixture(prisma, [], {
      name: `fixture-pi-r-role-${randomUUID()}`,
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('pi-r-subj')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    const beforeGrant = await agent.get('/api/v1/admin/org-units').set('Origin', appOrigin);
    expect(beforeGrant.status).toBe(403);

    await roleAdmin.update({
      actorUserId: platformActor.id,
      roleId: role.id,
      permissionIdentifiers: ['org_unit:administer'],
    });

    const afterGrant = await agent.get('/api/v1/admin/org-units').set('Origin', appOrigin);
    expect(afterGrant.status).toBe(200);
  });
});
