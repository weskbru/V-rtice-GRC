import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
  makeRiskAssignmentVisible,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import {
  createLocalUserFixture,
  createOrgUnitFixture,
  createUserFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface RiskDetailBody {
  readonly id: string;
}

interface ProblemBody {
  readonly type: string;
  readonly title: string;
  readonly status: number;
}

interface RiskHistoryEntryBody {
  readonly type: string;
  readonly occurredAt: string;
  readonly actor: { readonly id: string; readonly fullName: string };
  readonly summary: string;
}

interface RiskHistoryPageBody {
  readonly data: readonly RiskHistoryEntryBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

describe('GET /risks/{riskId}/history (T167, D-11, ADR-006, FR-105)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerUserId: string;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const marker = uniqueTestMarker('risk-history-contract');
    const orgUnit = await createOrgUnitFixture(prisma, { code: `${marker}-org` });
    orgUnitId = orgUnit.id;
    const owner = await createUserFixture(prisma, { email: `${marker}-owner@example.test` });
    ownerUserId = owner.id;
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
    const category = await prisma.client.riskCategory.create({
      data: {
        id: randomUUID(),
        code: `${marker}-category`,
        name: 'Categoria de teste',
        description: 'Fixture category.',
        sortOrder: 1,
        isActive: true,
      },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await ctx.app
      .get(PrismaService)
      .client.riskCategory.update({ where: { id: categoryId }, data: { isActive: false } });
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: Parameters<typeof createRoleWithPermissionsFixture>[1],
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${randomUUID()}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-risk-history-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return agent;
  }

  async function createRisk(agent: ReturnType<typeof request.agent>): Promise<string> {
    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para teste de histórico (contrato)',
      description: 'Descrição do risco.',
      categoryId,
      orgUnitId,
      ownerUserId,
    });
    expect(response.status).toBe(201);
    return (response.body as RiskDetailBody).id;
  }

  it('succeeds for a caller holding risk:view and returns the declared {data, meta} envelope with real pagination values', async () => {
    const agent = await agentWithPermissions(['risk:create', 'risk:view']);
    const id = await createRisk(agent);

    const response = await agent
      .get(`/api/v1/risks/${id}/history`)
      .set('Origin', appOrigin)
      .query({ page: 1, pageSize: 10 });

    expect(response.status).toBe(200);
    const body = response.body as RiskHistoryPageBody;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toEqual({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  });

  it('a zero-permission authenticated user succeeds ONLY if risk:view is held — refuses (403) a caller with risk:view genuinely absent from their role', async () => {
    const creator = await agentWithPermissions(['risk:create', 'risk:view']);
    const id = await createRisk(creator);

    const bare = await agentWithPermissions([]);
    const response = await bare.get(`/api/v1/risks/${id}/history`).set('Origin', appOrigin);

    expect(response.status).toBe(403);
  });

  it('an out-of-scope risk is 404 — indistinguishable from a nonexistent one (ADR-009)', async () => {
    const creator = await agentWithPermissions(['risk:create', 'risk:view']);
    const id = await createRisk(creator);

    const otherOrgUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
      code: uniqueTestMarker('risk-history-other-org'),
    });
    const prisma = ctx.app.get(PrismaService);
    const outsider = await createLocalUserFixture(prisma, {
      email: `${randomUUID()}@example.test`,
      primaryOrgUnitId: otherOrgUnit.id,
    });
    const outsiderRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-risk-history-outsider-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: outsider.user, role: outsiderRole });
    await grantUnitScopeFixture(prisma, { user: outsider.user, orgUnitId: otherOrgUnit.id });

    const outsiderAgent = request.agent(ctx.app.getHttpServer());
    const login = await outsiderAgent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: outsider.user.email, password: outsider.rawPassword });
    expect(login.status).toBe(200);

    const outOfScopeResponse = await outsiderAgent
      .get(`/api/v1/risks/${id}/history`)
      .set('Origin', appOrigin);
    const nonexistentResponse = await outsiderAgent
      .get(`/api/v1/risks/${randomUUID()}/history`)
      .set('Origin', appOrigin);

    expect(outOfScopeResponse.status).toBe(404);
    expect(nonexistentResponse.status).toBe(404);
    const nonexistentProblem = nonexistentResponse.body as ProblemBody;
    expect(outOfScopeResponse.body).toMatchObject({
      type: nonexistentProblem.type,
      title: nonexistentProblem.title,
      status: nonexistentProblem.status,
    });
  });

  it('refuses an unauthenticated caller — 401', async () => {
    const response = await request(ctx.app.getHttpServer()).get(
      `/api/v1/risks/${randomUUID()}/history`,
    );
    expect(response.status).toBe(401);
  });
});
