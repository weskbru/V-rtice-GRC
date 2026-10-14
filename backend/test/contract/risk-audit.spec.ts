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

interface AuditEventBody {
  readonly id: string;
  readonly occurredAt: string;
  readonly action: string;
  readonly entityType: string;
}

interface AuditEventsPageBody {
  readonly data: readonly AuditEventBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

describe('GET /risks/{riskId}/audit-events (T164, T168, D-11, US7)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerUserId: string;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const marker = uniqueTestMarker('risk-audit-contract');
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
      name: `fixture-risk-audit-role-${randomUUID()}`,
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
      title: 'Risco para teste de auditoria (contrato)',
      description: 'Descrição do risco.',
      categoryId,
      orgUnitId,
      ownerUserId,
    });
    expect(response.status).toBe(201);
    return (response.body as RiskDetailBody).id;
  }

  it('succeeds for a caller holding BOTH risk:view and audit:view, returning the declared {data, meta} envelope, and includes the risk.created audit entry', async () => {
    const agent = await agentWithPermissions(['risk:create', 'risk:view', 'audit:view']);
    const id = await createRisk(agent);

    const response = await agent
      .get(`/api/v1/risks/${id}/audit-events`)
      .set('Origin', appOrigin)
      .query({ page: 1, pageSize: 10 });

    expect(response.status).toBe(200);
    const body = response.body as AuditEventsPageBody;
    expect(body.meta).toEqual({ page: 1, pageSize: 10, total: body.data.length, totalPages: 1 });
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.some((e) => e.action === 'risk.created')).toBe(true);
    expect(body.data.every((e) => e.entityType === 'RISK')).toBe(true);
  });

  it('a caller with risk:view but WITHOUT audit:view — who can otherwise see the risk — is refused 403 (US7 AS4: existence already known, nothing new disclosed)', async () => {
    const creator = await agentWithPermissions(['risk:create', 'risk:view', 'audit:view']);
    const id = await createRisk(creator);

    const viewerOnly = await agentWithPermissions(['risk:view']);
    const response = await viewerOnly
      .get(`/api/v1/risks/${id}/audit-events`)
      .set('Origin', appOrigin);

    expect(response.status).toBe(403);
  });

  it('a caller who cannot see the risk at all (no risk:view) is refused 404, not 403 — the audit:view gate is never reached', async () => {
    const creator = await agentWithPermissions(['risk:create', 'risk:view', 'audit:view']);
    const id = await createRisk(creator);

    const auditOnly = await agentWithPermissions(['audit:view']);
    const response = await auditOnly
      .get(`/api/v1/risks/${id}/audit-events`)
      .set('Origin', appOrigin);

    expect(response.status).toBe(404);
  });

  it('scope-filtered: an out-of-scope risk is 404, identical in shape to a nonexistent one', async () => {
    const creator = await agentWithPermissions(['risk:create', 'risk:view', 'audit:view']);
    const id = await createRisk(creator);

    const prisma = ctx.app.get(PrismaService);
    const otherOrgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-audit-other-org'),
    });
    const outsider = await createLocalUserFixture(prisma, {
      email: `${randomUUID()}@example.test`,
      primaryOrgUnitId: otherOrgUnit.id,
    });
    const outsiderRole = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:view', 'audit:view'],
      { name: `fixture-risk-audit-outsider-role-${randomUUID()}` },
    );
    await assignRoleFixture(prisma, { user: outsider.user, role: outsiderRole });
    await grantUnitScopeFixture(prisma, { user: outsider.user, orgUnitId: otherOrgUnit.id });

    const outsiderAgent = request.agent(ctx.app.getHttpServer());
    const login = await outsiderAgent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: outsider.user.email, password: outsider.rawPassword });
    expect(login.status).toBe(200);

    const outOfScopeResponse = await outsiderAgent
      .get(`/api/v1/risks/${id}/audit-events`)
      .set('Origin', appOrigin);
    const nonexistentResponse = await outsiderAgent
      .get(`/api/v1/risks/${randomUUID()}/audit-events`)
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
      `/api/v1/risks/${randomUUID()}/audit-events`,
    );
    expect(response.status).toBe(401);
  });

  it('never exposes secrets: no password hash, token, session identifier or internal-only field appears in any audit entry payload', async () => {
    const agent = await agentWithPermissions(['risk:create', 'risk:view', 'audit:view']);
    const id = await createRisk(agent);

    const response = await agent
      .get(`/api/v1/risks/${id}/audit-events`)
      .set('Origin', appOrigin)
      .query({ page: 1, pageSize: 50 });

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body).toLowerCase();
    expect(serialized).not.toMatch(/passwordhash|"hash"|sessionid|"token"|secret/);
  });
});
