/**
 * T135 — treatment operations refused without `risk:treat` (FR-071 to
 * FR-074c), plus full D-11 coverage for every endpoint this dispatch adds
 * under "Risk Treatment": the stated authorization rule (including a
 * zero-permission/wrong-permission caller refused), 401 for an
 * unauthenticated caller, and the declared response shape.
 */
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

interface ProblemBody {
  readonly status: number;
  readonly title: string;
}

interface RiskDetailBody {
  readonly id: string;
}

interface UserRefBody {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

interface TreatmentDecisionBody {
  readonly id: string;
  readonly strategy: string;
  readonly description: string;
  readonly deadline: string | null;
  readonly decidedBy: UserRefBody;
  readonly decidedAt: string;
  readonly supersededAt: string | null;
  readonly deadlineOverdue: boolean;
}

interface TreatmentActionBody {
  readonly id: string;
  readonly treatmentDecisionId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly responsible: UserRefBody;
  readonly dueOn: string;
  readonly status: string;
  readonly overdue: boolean;
  readonly completedAt: string | null;
  readonly createdAt: string;
}

interface PageMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

interface TreatmentDecisionPageBody {
  readonly data: readonly TreatmentDecisionBody[];
  readonly meta: PageMeta;
}

interface TreatmentActionPageBody {
  readonly data: readonly TreatmentActionBody[];
  readonly meta: PageMeta;
}

describe('Risk Treatment endpoints (T135, T143, FR-071 to FR-075, D-11)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-treatment-contract-org'),
    });
    orgUnitId = orgUnit.id;
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-treatment-contract-owner')}@example.test`,
    });
    ownerUserId = owner.id;
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** Logs in a fresh user granted `permissions` (plus `risk:create`,
   * `risk:view` unless the caller only wants the bare permission under
   * test), scoped to the shared org unit, and returns a fresh `DRAFT` risk
   * created by that agent along with the ETag/version to use as `If-Match`. */
  async function agentWithPermissions(
    permissions: Parameters<typeof createRoleWithPermissionsFixture>[1],
  ): Promise<{ agent: ReturnType<typeof request.agent> }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-treatment-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-risk-treatment-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent };
  }

  async function createRisk(
    agent: ReturnType<typeof request.agent>,
  ): Promise<{ id: string; version: string }> {
    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para testes de tratamento',
      description: 'Descrição do risco.',
      orgUnitId,
      ownerUserId,
    });
    expect(response.status).toBe(201);
    const body = response.body as RiskDetailBody;
    return { id: body.id, version: response.headers.etag! };
  }

  // -------------------------------------------------------------------
  // POST /risks/{riskId}/treatments
  // -------------------------------------------------------------------

  describe('POST /risks/{riskId}/treatments', () => {
    it('succeeds for a caller holding risk:treat and returns the declared RiskTreatmentDecision shape', async () => {
      const { agent } = await agentWithPermissions(['risk:create', 'risk:view', 'risk:treat']);
      const { id, version } = await createRisk(agent);

      const response = await agent
        .post(`/api/v1/risks/${id}/treatments`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({
          strategy: 'MITIGATE',
          description: 'Mitigar via controles adicionais.',
          deadline: '2027-06-30',
        });

      expect(response.status).toBe(201);
      expect(response.headers.etag).toBeDefined();
      expect(response.headers.location).toContain(`/risks/${id}/treatments/`);
      const body = response.body as TreatmentDecisionBody;
      expect(body.id).toBeTruthy();
      expect(body.strategy).toBe('MITIGATE');
      expect(body.description).toBe('Mitigar via controles adicionais.');
      expect(body.deadline).toBe('2027-06-30');
      expect(body.decidedBy.id).toBeTruthy();
      expect(body.decidedAt).toBeTruthy();
      expect(body.supersededAt).toBeNull();
      expect(typeof body.deadlineOverdue).toBe('boolean');
    });

    it('refuses a caller with risk:view but WITHOUT risk:treat — 403 (T135)', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const { id, version } = await createRisk(creatorAgent);

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view']);
      const response = await viewerAgent
        .post(`/api/v1/risks/${id}/treatments`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ strategy: 'ACCEPT', description: 'Tentativa sem permissão.' });

      expect(response.status).toBe(403);
    });

    it('refuses a zero-permission authenticated caller — 403 (T135)', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const { id, version } = await createRisk(creatorAgent);

      const { agent: bareAgent } = await agentWithPermissions([]);
      const response = await bareAgent
        .post(`/api/v1/risks/${id}/treatments`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ strategy: 'ACCEPT', description: 'Tentativa sem qualquer permissão.' });

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/risks/${randomUUID()}/treatments`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"')
        .send({ strategy: 'ACCEPT', description: 'x' });

      expect(response.status).toBe(401);
      const body = response.body as ProblemBody;
      expect(body.status).toBe(401);
    });
  });

  describe('GET /risks/{riskId}/treatments', () => {
    it('succeeds for a caller holding ONLY risk:view (no risk:treat) and returns the {data, meta} envelope, newest first, including superseded decisions', async () => {
      const { agent } = await agentWithPermissions(['risk:create', 'risk:view', 'risk:treat']);
      const { id, version } = await createRisk(agent);

      const firstDecision = await agent
        .post(`/api/v1/risks/${id}/treatments`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ strategy: 'MITIGATE', description: 'Primeira decisão.' });
      expect(firstDecision.status).toBe(201);

      const secondDecision = await agent
        .post(`/api/v1/risks/${id}/treatments`)
        .set('Origin', appOrigin)
        .set('If-Match', firstDecision.headers.etag!)
        .send({ strategy: 'ACCEPT', description: 'Segunda decisão, supersede a primeira.' });
      expect(secondDecision.status).toBe(201);

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view']);
      // The viewer has no scope grant of its own by default, but the org
      // unit is shared — grant it explicitly so this exercises risk:view
      // alone, not scope.
      // (agentWithPermissions already grants scope over the shared org unit.)
      const response = await viewerAgent
        .get(`/api/v1/risks/${id}/treatments`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as TreatmentDecisionPageBody;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.data).toHaveLength(2);
      expect(body.meta).toEqual({ page: 1, pageSize: 25, total: 2, totalPages: 1 });

      // Newest first; the superseded first decision is still present.
      const second = secondDecision.body as TreatmentDecisionBody;
      expect(body.data[0]!.id).toBe(second.id);
      expect(body.data[1]!.supersededAt).not.toBeNull();
    });

    it('refuses a caller lacking risk:view — 403', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const { id } = await createRisk(creatorAgent);

      const { agent: bareAgent } = await agentWithPermissions([]);
      const response = await bareAgent
        .get(`/api/v1/risks/${id}/treatments`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/risks/${randomUUID()}/treatments`,
      );
      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // POST /risks/{riskId}/treatment-actions
  // -------------------------------------------------------------------

  describe('POST /risks/{riskId}/treatment-actions', () => {
    it('succeeds for a caller holding risk:treat and returns the declared RiskTreatmentAction shape', async () => {
      const { agent } = await agentWithPermissions(['risk:create', 'risk:view', 'risk:treat']);
      const { id, version } = await createRisk(agent);

      const response = await agent
        .post(`/api/v1/risks/${id}/treatment-actions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({
          title: 'Implementar controle X',
          responsibleUserId: ownerUserId,
          dueOn: '2026-12-31',
        });

      expect(response.status).toBe(201);
      expect(response.headers.etag).toBeDefined();
      expect(response.headers.location).toContain(`/risks/${id}/treatment-actions/`);
      const body = response.body as TreatmentActionBody;
      expect(body.id).toBeTruthy();
      expect(body.title).toBe('Implementar controle X');
      expect(body.responsible.id).toBe(ownerUserId);
      expect(body.dueOn).toBe('2026-12-31');
      expect(body.status).toBe('OPEN');
      expect(body.overdue).toBe(false);
      expect(body.completedAt).toBeNull();
      expect(body.createdAt).toBeTruthy();
    });

    it('refuses a caller lacking risk:treat — 403 (T135)', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const { id, version } = await createRisk(creatorAgent);

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view']);
      const response = await viewerAgent
        .post(`/api/v1/risks/${id}/treatment-actions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ title: 'x', responsibleUserId: ownerUserId, dueOn: '2026-12-31' });

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/risks/${randomUUID()}/treatment-actions`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"')
        .send({ title: 'x', responsibleUserId: ownerUserId, dueOn: '2026-12-31' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /risks/{riskId}/treatment-actions', () => {
    it('succeeds for a caller holding ONLY risk:view and returns the {data, meta} envelope with a real, computed overdue flag', async () => {
      const { agent } = await agentWithPermissions(['risk:create', 'risk:view', 'risk:treat']);
      const { id, version } = await createRisk(agent);

      const overdueAction = await agent
        .post(`/api/v1/risks/${id}/treatment-actions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ title: 'Ação vencida', responsibleUserId: ownerUserId, dueOn: '2020-01-01' });
      expect(overdueAction.status).toBe(201);

      const futureAction = await agent
        .post(`/api/v1/risks/${id}/treatment-actions`)
        .set('Origin', appOrigin)
        .set('If-Match', overdueAction.headers.etag!)
        .send({ title: 'Ação futura', responsibleUserId: ownerUserId, dueOn: '2099-01-01' });
      expect(futureAction.status).toBe(201);

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view']);
      const response = await viewerAgent
        .get(`/api/v1/risks/${id}/treatment-actions`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as TreatmentActionPageBody;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(2);

      const byTitle = new Map(body.data.map((action) => [action.title, action]));
      expect(byTitle.get('Ação vencida')!.overdue).toBe(true);
      expect(byTitle.get('Ação futura')!.overdue).toBe(false);
    });

    it('refuses a caller lacking risk:view — 403', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const { id } = await createRisk(creatorAgent);

      const { agent: bareAgent } = await agentWithPermissions([]);
      const response = await bareAgent
        .get(`/api/v1/risks/${id}/treatment-actions`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/risks/${randomUUID()}/treatment-actions`,
      );
      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // PATCH /risks/{riskId}/treatment-actions/{actionId}
  // -------------------------------------------------------------------

  describe('PATCH /risks/{riskId}/treatment-actions/{actionId}', () => {
    it('succeeds for a caller holding risk:treat, stamps completedAt on transition to COMPLETED, and returns the declared shape', async () => {
      const { agent } = await agentWithPermissions(['risk:create', 'risk:view', 'risk:treat']);
      const { id, version } = await createRisk(agent);

      const created = await agent
        .post(`/api/v1/risks/${id}/treatment-actions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ title: 'Ação a concluir', responsibleUserId: ownerUserId, dueOn: '2026-12-31' });
      expect(created.status).toBe(201);
      const action = created.body as TreatmentActionBody;

      // 007-implementation-remediation, Frente A — `Action`'s lifecycle
      // table (data-model.md §4, FR-011 to FR-016,
      // `grc/action/domain/action.entity.ts`'s own `LEGAL_TRANSITIONS`) does
      // NOT include `OPEN -> COMPLETED` directly: completion always passes
      // through `IN_PROGRESS` first. Before the Action convergence, this
      // route wrote `risk_treatment_actions.status` directly with no
      // legality check at all, so the old version of this test jumped
      // straight from OPEN to COMPLETED in one PATCH. That path is now
      // illegal by design (every treatment-action status write goes through
      // the SAME shared table every other Action-backed workflow uses), so
      // this test exercises the real two-step lifecycle instead.
      const inProgress = await agent
        .patch(`/api/v1/risks/${id}/treatment-actions/${action.id}`)
        .set('Origin', appOrigin)
        .set('If-Match', created.headers.etag!)
        .send({ status: 'IN_PROGRESS' });
      expect(inProgress.status).toBe(200);

      const response = await agent
        .patch(`/api/v1/risks/${id}/treatment-actions/${action.id}`)
        .set('Origin', appOrigin)
        .set('If-Match', inProgress.headers.etag!)
        .send({ status: 'COMPLETED' });

      expect(response.status).toBe(200);
      expect(response.headers.etag).toBeDefined();
      const body = response.body as TreatmentActionBody;
      expect(body.status).toBe('COMPLETED');
      expect(body.completedAt).not.toBeNull();
      expect(body.overdue).toBe(false);
    });

    it('refuses a caller lacking risk:treat — 403 (T135)', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const { id, version } = await createRisk(creatorAgent);
      const created = await creatorAgent
        .post(`/api/v1/risks/${id}/treatment-actions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ title: 'x', responsibleUserId: ownerUserId, dueOn: '2026-12-31' });
      const action = created.body as TreatmentActionBody;

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view']);
      const response = await viewerAgent
        .patch(`/api/v1/risks/${id}/treatment-actions/${action.id}`)
        .set('Origin', appOrigin)
        .set('If-Match', created.headers.etag!)
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .patch(`/api/v1/risks/${randomUUID()}/treatment-actions/${randomUUID()}`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"')
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(401);
    });
  });
});
