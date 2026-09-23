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

interface FrameworkBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

interface FrameworkPageBody {
  readonly data: readonly FrameworkBody[];
  readonly meta: { readonly total: number };
}

describe('Compliance normative library carries no organizational scope (T018, research.md D-2, FR-022)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let frameworkId: string;
  let frameworkCode: string;

  async function agentScopedToUnrelatedUnit(): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const unrelatedUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('compliance-unscoped-unit'),
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('compliance-unscoped-actor')}@example.test`,
      primaryOrgUnitId: unrelatedUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(prisma, ['compliance:view'], {
      name: `fixture-compliance-unscoped-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: unrelatedUnit.id });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return agent;
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const adminAgent = await (async () => {
      const prisma = ctx.app.get(PrismaService);
      const fixture = await createLocalUserFixture(prisma, {
        email: `${uniqueTestMarker('compliance-unscoped-admin')}@example.test`,
      });
      const role = await createRoleWithPermissionsFixture(prisma, ['compliance:administer'], {
        name: `fixture-compliance-unscoped-admin-role-${randomUUID()}`,
      });
      await assignRoleFixture(prisma, { user: fixture.user, role });
      const agent = request.agent(ctx.app.getHttpServer());
      const loginResponse = await agent
        .post('/api/v1/auth/login')
        .set('Origin', appOrigin)
        .send({ email: fixture.user.email, password: fixture.rawPassword });
      expect(loginResponse.status).toBe(200);
      return agent;
    })();

    const createResponse = await adminAgent
      .post('/api/v1/frameworks')
      .set('Origin', appOrigin)
      .send({
        name: uniqueTestMarker('Unscoped catalog framework'),
        description: 'Fixture framework for the unscoped-catalog guard.',
        origin: 'EXTERNAL_STANDARD',
      });
    expect(createResponse.status).toBe(201);
    const body = createResponse.body as FrameworkBody;
    frameworkId = body.id;
    frameworkCode = body.code;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('an actor scoped to a unit unrelated to anything still reads the framework by id (no 404, no scope denial)', async () => {
    const agent = await agentScopedToUnrelatedUnit();

    const response = await agent.get(`/api/v1/frameworks/${frameworkId}`).set('Origin', appOrigin);

    expect(response.status).toBe(200);
    expect((response.body as FrameworkBody).id).toBe(frameworkId);
  });

  it('the same actor sees the framework in the unfiltered catalog listing', async () => {
    const agent = await agentScopedToUnrelatedUnit();

    const response = await agent
      .get('/api/v1/frameworks')
      .query({ q: frameworkCode })
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as FrameworkPageBody;
    expect(body.data.some((framework) => framework.id === frameworkId)).toBe(true);
  });
});
