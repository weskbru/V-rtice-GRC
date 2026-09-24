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
  createMethodologyVersionFixture,
  createOrgUnitFixture,
  createUserFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface DashboardLinkBody {
  readonly path: string;
}

interface DashboardRiskItemBody {
  readonly riskId: string;
  readonly code: string;
  readonly title: string;
  readonly residualLevel: string | null;
  readonly dueContext: string | null;
}

interface DashboardActionItemBody {
  readonly actionId: string;
  readonly riskId: string;
  readonly riskCode: string;
  readonly title: string;
  readonly dueOn: string;
  readonly responsible: { readonly id: string; readonly fullName: string; readonly email: string };
}

interface DashboardBody {
  readonly risks: {
    readonly total: number;
    readonly byResidualLevel: Record<string, number>;
    readonly byStatus: Record<string, number>;
    readonly link: DashboardLinkBody;
  };
  readonly pendingApprovals: {
    readonly total: number;
    readonly items: readonly DashboardRiskItemBody[];
  };
  readonly overdueActions: {
    readonly total: number;
    readonly items: readonly DashboardActionItemBody[];
    readonly link: DashboardLinkBody;
  };
  readonly itemsRequiringReview: {
    readonly total: number;
    readonly items: readonly DashboardRiskItemBody[];
    readonly link: DashboardLinkBody;
  };
  readonly treatmentActions: {
    readonly total: number;
    readonly open: number;
    readonly overdue: number;
  };
  readonly plannedAreas: readonly {
    readonly key: string;
    readonly label: string;
    readonly status: string;
  }[];
}

interface ProblemBody {
  readonly status: number;
}

interface RiskDetailBody {
  readonly id: string;
  readonly status: string;
}

interface RegisterPageBody {
  readonly meta: { readonly total: number };
}

const RISK_LEVEL_BANDS_RESIDUAL_HIGH = { probability: 5, impact: 2 };

describe('GET /dashboard — the GRC dashboard aggregates (T197, FR-047 to FR-052)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const methodologyAuthor = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('dashboard-methodology-author')}@example.test`,
    });
    await createMethodologyVersionFixture(prisma, methodologyAuthor.id);

    const marker = uniqueTestMarker('dashboard-category');
    const category = await prisma.client.riskCategory.create({
      data: {
        id: randomUUID(),
        code: marker,
        name: 'Categoria de teste do dashboard',
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
    permissions: readonly PermissionIdentifier[],
    orgUnitId?: string,
  ): Promise<{ agent: ReturnType<typeof request.agent>; orgUnitId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const unit =
      orgUnitId ??
      (await createOrgUnitFixture(prisma, { code: uniqueTestMarker('dashboard-org') })).id;
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('dashboard-actor')}@example.test`,
      primaryOrgUnitId: unit,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-dashboard-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: unit });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, orgUnitId: unit };
  }

  async function agentWithNoScopeGrant(
    permissions: readonly PermissionIdentifier[],
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('dashboard-noscope-actor')}@example.test`,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-dashboard-noscope-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return agent;
  }

  async function createRisk(
    agent: ReturnType<typeof request.agent>,
    orgUnitId: string,
    ownerUserId: string,
  ): Promise<{ id: string; etag: string }> {
    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para testes do dashboard',
      description: 'Descrição do risco de teste do dashboard.',
      categoryId,
      orgUnitId,
      ownerUserId,
    });
    expect(response.status).toBe(201);
    const body = response.body as RiskDetailBody;
    return { id: body.id, etag: response.headers.etag! };
  }

  async function assessRiskHigh(
    agent: ReturnType<typeof request.agent>,
    riskId: string,
    etag: string,
  ): Promise<string> {
    const response = await agent
      .post(`/api/v1/risks/${riskId}/assessments`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({
        inherentProbability: 3,
        inherentImpact: 3,
        residualProbability: RISK_LEVEL_BANDS_RESIDUAL_HIGH.probability,
        residualImpact: RISK_LEVEL_BANDS_RESIDUAL_HIGH.impact,
        rationale: 'Avaliação de teste do dashboard.',
      });
    expect(response.status).toBe(201);
    return response.headers.etag!;
  }

  it('refuses an unauthenticated caller with 401', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/v1/dashboard');
    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(401);
  });

  it('succeeds (200, never 403) for a zero-permission authenticated caller, with every risk-backed area zeroed and plannedAreas present (currently empty — no domain is registered as planned)', async () => {
    const { agent } = await agentWithPermissions([]);

    const response = await agent.get('/api/v1/dashboard').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as DashboardBody;

    expect(body.risks.total).toBe(0);
    for (const count of Object.values(body.risks.byResidualLevel)) {
      expect(count).toBe(0);
    }
    for (const count of Object.values(body.risks.byStatus)) {
      expect(count).toBe(0);
    }
    expect(body.pendingApprovals).toEqual({ total: 0, items: [] });
    expect(body.overdueActions.total).toBe(0);
    expect(body.overdueActions.items).toEqual([]);
    expect(body.itemsRequiringReview.total).toBe(0);
    expect(body.itemsRequiringReview.items).toEqual([]);
    expect(body.treatmentActions).toEqual({ total: 0, open: 0, overdue: 0 });

    const keys = body.plannedAreas.map((area) => area.key);
    expect(body.plannedAreas).toEqual([]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const area of body.plannedAreas) {
      expect(area.status).toBe('PLANNED');
      expect(typeof area.label).toBe('string');
      expect(area.label.length).toBeGreaterThan(0);
    }
  });

  it('returns the declared Dashboard shape with real data for a caller holding risk:view', async () => {
    const { agent, orgUnitId } = await agentWithPermissions([
      'risk:create',
      'risk:view',
      'risk:assess',
    ]);
    const owner = await createUserFixture(ctx.app.get(PrismaService), {
      email: `${uniqueTestMarker('dashboard-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.app.get(PrismaService), { user: owner, orgUnitId });
    const { id, etag } = await createRisk(agent, orgUnitId, owner.id);
    await assessRiskHigh(agent, id, etag);

    const response = await agent.get('/api/v1/dashboard').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as DashboardBody;

    expect(body.risks.total).toBeGreaterThanOrEqual(1);
    expect(body.risks.byResidualLevel.HIGH).toBeGreaterThanOrEqual(1);
    expect(Object.keys(body.risks.byResidualLevel).sort()).toEqual(
      ['CRITICAL', 'HIGH', 'LOW', 'MEDIUM'].sort(),
    );
    expect(Object.keys(body.risks.byStatus).sort()).toEqual(
      [
        'ACCEPTED',
        'ARCHIVED',
        'ASSESSED',
        'CLOSED',
        'DRAFT',
        'IDENTIFIED',
        'UNDER_REVIEW',
        'UNDER_TREATMENT',
      ].sort(),
    );
    expect(body.risks.link).toEqual({ path: '/risks' });
    expect(body.overdueActions.link).toEqual({ path: '/risks?overdueTreatment=true' });
    expect(body.itemsRequiringReview.link).toEqual({ path: '/risks?overdueReview=true' });
    expect(Array.isArray(body.plannedAreas)).toBe(true);
  });

  it("two callers scoped to different organizational units see different totals, each excluding the other's risk", async () => {
    const prisma = ctx.app.get(PrismaService);
    const { agent: agentA, orgUnitId: unitA } = await agentWithPermissions([
      'risk:create',
      'risk:view',
    ]);
    const { agent: agentB } = await agentWithPermissions(['risk:view']);

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('dashboard-scope-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: unitA });
    await createRisk(agentA, unitA, owner.id);

    const beforeB = await agentB.get('/api/v1/dashboard').set('Origin', appOrigin);
    expect(beforeB.status).toBe(200);
    const bodyBefore = beforeB.body as DashboardBody;
    const totalBefore = bodyBefore.risks.total;

    const responseA = await agentA.get('/api/v1/dashboard').set('Origin', appOrigin);
    expect(responseA.status).toBe(200);
    const bodyA = responseA.body as DashboardBody;
    expect(bodyA.risks.total).toBeGreaterThanOrEqual(1);

    const responseB = await agentB.get('/api/v1/dashboard').set('Origin', appOrigin);
    expect(responseB.status).toBe(200);
    const bodyB = responseB.body as DashboardBody;
    expect(bodyB.risks.total).toBe(totalBefore);
  });

  it('a caller with risk:view but NO organizational scope grant at all sees zeros, never an error and never every risk', async () => {
    const agent = await agentWithNoScopeGrant(['risk:view']);

    const response = await agent.get('/api/v1/dashboard').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as DashboardBody;
    expect(body.risks.total).toBe(0);
    expect(body.itemsRequiringReview.total).toBe(0);
    expect(body.overdueActions.total).toBe(0);
  });

  it('agrees with the register: risks.byResidualLevel.HIGH equals GET /risks?riskLevel=HIGH&riskLevelBasis=RESIDUAL meta.total for the same caller', async () => {
    const { agent, orgUnitId } = await agentWithPermissions([
      'risk:create',
      'risk:view',
      'risk:assess',
    ]);
    const owner = await createUserFixture(ctx.app.get(PrismaService), {
      email: `${uniqueTestMarker('dashboard-agree-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(ctx.app.get(PrismaService), { user: owner, orgUnitId });
    const { id, etag } = await createRisk(agent, orgUnitId, owner.id);
    await assessRiskHigh(agent, id, etag);

    const dashboardResponse = await agent.get('/api/v1/dashboard').set('Origin', appOrigin);
    expect(dashboardResponse.status).toBe(200);
    const dashboardBody = dashboardResponse.body as DashboardBody;

    const registerResponse = await agent
      .get('/api/v1/risks')
      .query({ riskLevel: 'HIGH', riskLevelBasis: 'RESIDUAL' })
      .set('Origin', appOrigin);
    expect(registerResponse.status).toBe(200);
    const registerBody = registerResponse.body as RegisterPageBody;

    expect(dashboardBody.risks.byResidualLevel.HIGH).toBe(registerBody.meta.total);
  });

  describe('pendingApprovals', () => {
    async function createPendingApprovalRisk(
      requesterAgent: ReturnType<typeof request.agent>,
      orgUnitId: string,
      ownerUserId: string,
    ): Promise<string> {
      const { id, etag } = await createRisk(requesterAgent, orgUnitId, ownerUserId);
      const etagAfterAssessment = await assessRiskHigh(requesterAgent, id, etag);

      const toIdentified = await requesterAgent
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', etagAfterAssessment)
        .send({ toStatus: 'IDENTIFIED' });
      expect(toIdentified.status).toBe(200);

      const toAssessed = await requesterAgent
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', toIdentified.headers.etag!)
        .send({ toStatus: 'ASSESSED' });
      expect(toAssessed.status).toBe(200);

      const approvalRequest = await requesterAgent
        .post(`/api/v1/risks/${id}/approvals`)
        .set('Origin', appOrigin)
        .set('If-Match', toAssessed.headers.etag!)
        .send({ toStatus: 'ACCEPTED', justification: 'Solicitação de teste do dashboard.' });
      expect(approvalRequest.status).toBe(201);

      return id;
    }

    it('a decider holding risk:view + risk:approve sees a pending approval requested by a DIFFERENT user in the same scope', async () => {
      const prisma = ctx.app.get(PrismaService);
      const orgUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('dashboard-approval-org'),
      });
      const { agent: requesterAgent } = await agentWithPermissions(
        ['risk:create', 'risk:view', 'risk:edit', 'risk:assess', 'risk:transition'],
        orgUnit.id,
      );
      const owner = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('dashboard-approval-owner')}@example.test`,
      });
      await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
      const riskId = await createPendingApprovalRisk(requesterAgent, orgUnit.id, owner.id);

      const { agent: deciderAgent } = await agentWithPermissions(
        ['risk:view', 'risk:approve'],
        orgUnit.id,
      );

      const response = await deciderAgent.get('/api/v1/dashboard').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as DashboardBody;

      expect(body.pendingApprovals.total).toBeGreaterThanOrEqual(1);
      expect(body.pendingApprovals.items.some((item) => item.riskId === riskId)).toBe(true);
    });

    it('a caller holding risk:view but NOT risk:approve sees pendingApprovals zeroed even when a pending approval exists in scope', async () => {
      const prisma = ctx.app.get(PrismaService);
      const orgUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('dashboard-approval-noapprove-org'),
      });
      const { agent: requesterAgent } = await agentWithPermissions(
        ['risk:create', 'risk:view', 'risk:edit', 'risk:assess', 'risk:transition'],
        orgUnit.id,
      );
      const owner = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('dashboard-approval-noapprove-owner')}@example.test`,
      });
      await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
      await createPendingApprovalRisk(requesterAgent, orgUnit.id, owner.id);

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view'], orgUnit.id);
      const response = await viewerAgent.get('/api/v1/dashboard').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as DashboardBody;
      expect(body.pendingApprovals).toEqual({ total: 0, items: [] });
    });
  });
});
