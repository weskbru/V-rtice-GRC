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

interface RiskSummaryBody {
  readonly id: string;
  readonly overdueTreatment: boolean;
}

interface RegisterPageBody {
  readonly data: readonly RiskSummaryBody[];
  readonly meta: { readonly total: number };
}

describe('GET /risks — overdueTreatment field and filter reflect real treatment data (T141)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;
  let orgUnitId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('ovd-reg-org'),
    });
    orgUnitId = orgUnit.id;

    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('ovd-reg-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:create', 'risk:view', 'risk:treat'],
      { name: `fixture-ovd-reg-role-${randomUUID()}` },
    );
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });

    agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('ovd-reg-owner')}@example.test`,
    });
    ownerUserId = owner.id;
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function createRiskWithAction(dueOn: string): Promise<string> {
    const createResponse = await agent
      .post('/api/v1/risks')
      .set('Origin', appOrigin)
      .send({
        title: `Risco com ação com vencimento em ${dueOn}`,
        description: 'Descrição do risco.',
        orgUnitId,
        ownerUserId,
      });
    expect(createResponse.status).toBe(201);
    const risk = createResponse.body as RiskDetailBody;

    const actionResponse = await agent
      .post(`/api/v1/risks/${risk.id}/treatment-actions`)
      .set('Origin', appOrigin)
      .set('If-Match', createResponse.headers.etag!)
      .send({ title: 'Ação de tratamento', responsibleUserId: ownerUserId, dueOn });
    expect(actionResponse.status).toBe(201);

    return risk.id;
  }

  it('overdueTreatment is true for a risk with a past-due, non-terminal action and false for one with only a future action', async () => {
    const overdueRiskId = await createRiskWithAction('2020-01-01');
    const futureRiskId = await createRiskWithAction('2099-01-01');

    const response = await agent
      .get('/api/v1/risks')
      .set('Origin', appOrigin)
      .query({ pageSize: 100 });
    expect(response.status).toBe(200);
    const body = response.body as RegisterPageBody;

    const byId = new Map(body.data.map((row) => [row.id, row]));
    expect(byId.get(overdueRiskId)!.overdueTreatment).toBe(true);
    expect(byId.get(futureRiskId)!.overdueTreatment).toBe(false);
  });

  it('the overdueTreatment=true filter restricts the register to risks with an overdue treatment action', async () => {
    const overdueRiskId = await createRiskWithAction('2019-06-15');
    const futureRiskId = await createRiskWithAction('2099-06-15');

    const response = await agent
      .get('/api/v1/risks')
      .set('Origin', appOrigin)
      .query({ overdueTreatment: 'true', pageSize: 100 });

    expect(response.status).toBe(200);
    const body = response.body as RegisterPageBody;
    const ids = body.data.map((row) => row.id);

    expect(ids).toContain(overdueRiskId);
    expect(ids).not.toContain(futureRiskId);
    for (const row of body.data) {
      expect(row.overdueTreatment).toBe(true);
    }
  });

  it('a completed action never counts as overdue, even with a past due date', async () => {
    const createResponse = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco com ação vencida porém concluída',
      description: 'Descrição do risco.',
      orgUnitId,
      ownerUserId,
    });
    const risk = createResponse.body as RiskDetailBody;

    const actionResponse = await agent
      .post(`/api/v1/risks/${risk.id}/treatment-actions`)
      .set('Origin', appOrigin)
      .set('If-Match', createResponse.headers.etag!)
      .send({ title: 'Ação concluída', responsibleUserId: ownerUserId, dueOn: '2018-01-01' });
    const action = actionResponse.body as { id: string };

    const inProgressResponse = await agent
      .patch(`/api/v1/risks/${risk.id}/treatment-actions/${action.id}`)
      .set('Origin', appOrigin)
      .set('If-Match', actionResponse.headers.etag!)
      .send({ status: 'IN_PROGRESS' });
    expect(inProgressResponse.status).toBe(200);

    const completeResponse = await agent
      .patch(`/api/v1/risks/${risk.id}/treatment-actions/${action.id}`)
      .set('Origin', appOrigin)
      .set('If-Match', inProgressResponse.headers.etag!)
      .send({ status: 'COMPLETED' });
    expect(completeResponse.status).toBe(200);

    const response = await agent
      .get('/api/v1/risks')
      .set('Origin', appOrigin)
      .query({ pageSize: 100 });
    const body = response.body as RegisterPageBody;
    const row = body.data.find((item) => item.id === risk.id);
    expect(row!.overdueTreatment).toBe(false);
  });
});
