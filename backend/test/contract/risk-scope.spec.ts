import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
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

interface RiskSummaryBody {
  readonly id: string;
}

interface RegisterPageBody {
  readonly data: readonly RiskSummaryBody[];
  readonly meta: { readonly total: number };
}

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly type: string;
  readonly detail: string;
}

describe('Organizational scope on the register and on direct retrieval (T101, FR-025, FR-030, FR-090)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let riskId: string;
  let riskOrgUnitId: string;
  let agentInScope: ReturnType<typeof request.agent>;
  let agentOutOfScope: ReturnType<typeof request.agent>;

  async function loginNewScopedActor(orgUnitId: string): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-scope-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-risk-scope-role-${randomUUID()}`,
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

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnitInScope = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-scope-in'),
    });
    const orgUnitOutOfScope = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-scope-out'),
    });
    riskOrgUnitId = orgUnitInScope.id;

    const creatorRole = await createRoleWithPermissionsFixture(prisma, ['risk:create'], {
      name: `fixture-risk-scope-creator-role-${randomUUID()}`,
    });
    const creator = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-scope-creator')}@example.test`,
      primaryOrgUnitId: orgUnitInScope.id,
    });
    await assignRoleFixture(prisma, { user: creator, role: creatorRole });
    await grantUnitScopeFixture(prisma, { user: creator, orgUnitId: orgUnitInScope.id });

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-scope-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnitInScope.id });
    const risk = await ctx.app.get(CreateRiskUseCase).execute({
      actorUserId: creator.id,
      title: 'Risco restrito a uma unidade',
      description: 'Não deve ser visível fora do seu escopo.',
      orgUnitId: orgUnitInScope.id,
      ownerUserId: owner.id,
    });
    riskId = risk.id;

    agentInScope = await loginNewScopedActor(orgUnitInScope.id);
    agentOutOfScope = await loginNewScopedActor(orgUnitOutOfScope.id);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists the risk for the in-scope actor but not for the out-of-scope actor (US3 AS6)', async () => {
    const inScopeResponse = await agentInScope
      .get('/api/v1/risks')
      .query({ orgUnitId: riskOrgUnitId })
      .set('Origin', appOrigin);
    expect(inScopeResponse.status).toBe(200);
    const inScopeBody = inScopeResponse.body as RegisterPageBody;
    expect(inScopeBody.data.some((row) => row.id === riskId)).toBe(true);

    const outOfScopeResponse = await agentOutOfScope.get('/api/v1/risks').set('Origin', appOrigin);
    expect(outOfScopeResponse.status).toBe(200);
    const outOfScopeBody = outOfScopeResponse.body as RegisterPageBody;
    expect(outOfScopeBody.data.some((row) => row.id === riskId)).toBe(false);
    expect(outOfScopeBody.meta.total).toBe(0);
  });

  it("an org unit filter never widens the caller's scope: the out-of-scope actor still gets nothing when explicitly filtering for the risk's own unit", async () => {
    const response = await agentOutOfScope
      .get('/api/v1/risks')
      .query({ orgUnitId: riskOrgUnitId })
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as RegisterPageBody;
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it('allows direct retrieval for the in-scope actor (200) and refuses it for the out-of-scope actor (404)', async () => {
    const inScopeResponse = await agentInScope
      .get(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin);
    expect(inScopeResponse.status).toBe(200);

    const outOfScopeResponse = await agentOutOfScope
      .get(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin);
    expect(outOfScopeResponse.status).toBe(404);
  });

  it('the out-of-scope 404 does not disclose existence: identical to the 404 for a random, nonexistent id (FR-030)', async () => {
    const nonexistentId = randomUUID();

    const outOfScopeResponse = await agentOutOfScope
      .get(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin);
    const nonexistentResponse = await agentOutOfScope
      .get(`/api/v1/risks/${nonexistentId}`)
      .set('Origin', appOrigin);

    expect(outOfScopeResponse.status).toBe(404);
    expect(nonexistentResponse.status).toBe(404);

    const outOfScopeBody = outOfScopeResponse.body as ProblemBody;
    const nonexistentBody = nonexistentResponse.body as ProblemBody;

    expect(nonexistentBody.status).toBe(outOfScopeBody.status);
    expect(nonexistentBody.title).toBe(outOfScopeBody.title);
    expect(nonexistentBody.type).toBe(outOfScopeBody.type);
    expect(outOfScopeBody.detail).toBe(`Risco ${riskId} não foi encontrado(a).`);
    expect(nonexistentBody.detail).toBe(`Risco ${nonexistentId} não foi encontrado(a).`);

    const raw = JSON.stringify(outOfScopeResponse.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
  });
});
