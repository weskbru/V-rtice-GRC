/**
 * D-11 coverage for `/actions` and `/actions/{actionId}[/transitions]`
 * (T039-T045a, 002-shared-grc-foundation US2): `listActions`,
 * `createAction`, `getAction`, `updateAction`, `transitionAction` — the
 * declared shape, the stated permission per route, 401 for an
 * unauthenticated caller, origin integrity (FR-031, R-001), the five-edge
 * transition table (422 for every illegal pair), reopen's reason
 * requirement (Invariant A2), the single computed-on-read overdue rule
 * (R-006, FR-014), organizational-scope non-disclosure (SC-005), and
 * `EvidenceSubjectType.ACTION` (T045a, FR-017).
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
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

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ProblemBody {
  readonly status: number;
  readonly title?: string;
  readonly detail?: string;
}

interface ActionBody {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: { readonly id: string };
  readonly originType: string;
  readonly originId: string;
  readonly originLabel?: string;
  readonly title: string;
  readonly status: string;
  readonly overdue: boolean;
  readonly completedAt: string | null;
  readonly reopenedAt: string | null;
}

interface ActionPageBody {
  readonly items: readonly ActionBody[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

interface EvidenceBody {
  readonly id: string;
}

interface RiskBody {
  readonly id: string;
}

describe('Action contract (T039-T045a, US2, D-11)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let otherOrgUnitId: string;
  let responsibleUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('action-contract-org'),
    });
    orgUnitId = orgUnit.id;
    const otherOrgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('action-contract-other-org'),
    });
    otherOrgUnitId = otherOrgUnit.id;
    const responsible = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('action-contract-responsible')}@example.test`,
    });
    responsibleUserId = responsible.id;
    // F-CV-2: `responsible` here is a pure precondition (risk owner, used
    // to satisfy risk creation across this whole file) — never the object
    // of any assertion. Made visible to both org units `createRisk`/the
    // reassignment scenario can put a risk in (`orgUnitId`, `otherOrgUnitId`).
    await makeRiskAssignmentVisible(prisma, { user: responsible, orgUnitId: orgUnit.id });
    await grantUnitScopeFixture(prisma, { user: responsible, orgUnitId: otherOrgUnit.id });
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
    scopedOrgUnitId: string = orgUnitId,
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('action-actor')}@example.test`,
      primaryOrgUnitId: scopedOrgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-action-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: scopedOrgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, userId: fixture.user.id };
  }

  /** Same shape as `agentWithPermissions`, but with a GLOBAL organizational
   * scope grant instead of a single-unit one — needed for the
   * "administrator reassigns a risk to a different unit" scenario below,
   * since `UpdateRiskUseCase` requires the actor's OWN scope to cover BOTH
   * the risk's current unit and the new one. */
  async function agentWithGlobalScope(
    permissions: readonly PermissionIdentifier[],
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('action-admin')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-action-admin-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantGlobalScopeFixture(prisma, { user: fixture.user });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, userId: fixture.user.id };
  }

  /** A `RISK_TREATMENT`-eligible origin: a risk the given agent may
   * `risk:treat`. Requires the agent to hold `risk:create`/`risk:view` too.
   * `riskOrgUnitId` defaults to the shared `orgUnitId` but MUST match the
   * agent's own scoped org unit when the caller was built against
   * `otherOrgUnitId` (`agentWithPermissions`'s second argument) — creation
   * itself is scope-checked (FR-031), so a mismatch here fails with 422
   * before this helper's own object under test is ever reached. */
  async function createRisk(
    agent: ReturnType<typeof request.agent>,
    riskOrgUnitId: string = orgUnitId,
  ): Promise<string> {
    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para testes de ação',
      description: 'Descrição do risco.',
      orgUnitId: riskOrgUnitId,
      ownerUserId: responsibleUserId,
    });
    expect(response.status).toBe(201);
    return (response.body as RiskBody).id;
  }

  function validCreateBody(
    riskId: string,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      originType: 'RISK_TREATMENT',
      originId: riskId,
      title: 'Corrigir configuração de firewall',
      responsibleUserId,
      // Comfortably in the future for any plausible test-run date, so
      // `overdue` defaults to `false` unless a test deliberately overrides
      // it with a past date (see the `2020-01-01` case below).
      dueOn: '2035-03-01',
      ...overrides,
    };
  }

  async function createActionViaApi(
    agent: ReturnType<typeof request.agent>,
    riskId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<ActionBody> {
    const response = await agent
      .post('/api/v1/actions')
      .set('Origin', appOrigin)
      .send(validCreateBody(riskId, overrides));
    expect(response.status).toBe(201);
    return response.body as ActionBody;
  }

  // -------------------------------------------------------------------
  // createAction
  // -------------------------------------------------------------------

  describe('POST /actions', () => {
    it('succeeds for a caller holding action:create + risk:treat and returns the declared Action shape', async () => {
      const { agent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const riskId = await createRisk(agent);
      const action = await createActionViaApi(agent, riskId);

      expect(action.id).toBeTruthy();
      expect(action.code).toMatch(/^ACT-\d{4}-\d{4,}$/);
      expect(action.originType).toBe('RISK_TREATMENT');
      expect(action.originId).toBe(riskId);
      expect(action.status).toBe('OPEN');
      expect(action.overdue).toBe(false);
      expect(action.completedAt).toBeNull();
      expect(action.reopenedAt).toBeNull();
    });

    it('refuses a caller lacking action:create — 403', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'action:create',
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const riskId = await createRisk(creatorAgent);

      const { agent } = await agentWithPermissions(['action:view']);
      const response = await agent
        .post('/api/v1/actions')
        .set('Origin', appOrigin)
        .send(validCreateBody(riskId));
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/actions')
        .set('Origin', appOrigin)
        .send(validCreateBody(randomUUID()));
      expect(response.status).toBe(401);
      const body = response.body as ProblemBody;
      expect(body.status).toBe(401);
    });

    it('T044: a valid originType with a NONEXISTENT originId is refused with 404 (origin integrity)', async () => {
      const { agent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'risk:view',
        'risk:treat',
      ]);
      const response = await agent
        .post('/api/v1/actions')
        .set('Origin', appOrigin)
        .send(validCreateBody(randomUUID()));
      expect(response.status).toBe(404);
    });

    it('T044: creating requires EDIT permission on the origin, not just enum validity — a caller with risk:view but WITHOUT risk:treat is refused 404', async () => {
      const { agent: ownerAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const riskId = await createRisk(ownerAgent);

      const { agent: viewerAgent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'risk:view',
      ]);
      const response = await viewerAgent
        .post('/api/v1/actions')
        .set('Origin', appOrigin)
        .send(validCreateBody(riskId));
      // NotFoundDomainError, not Forbidden — indistinguishable from unknown
      // (SC-005), even though the caller CAN see the risk (risk:view) and
      // it genuinely exists.
      expect(response.status).toBe(404);
    });

    it('T044/SC-005: an origin outside the caller organizational scope is refused 404, byte-identical to an unknown origin', async () => {
      const { agent: ownerAgent } = await agentWithPermissions(
        ['risk:create', 'risk:view', 'risk:treat'],
        otherOrgUnitId,
      );
      const riskId = await createRisk(ownerAgent, otherOrgUnitId);

      const { agent: outsiderAgent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'risk:view',
        'risk:treat',
      ]);

      const outOfScopeResponse = await outsiderAgent
        .post('/api/v1/actions')
        .set('Origin', appOrigin)
        .send(validCreateBody(riskId));
      const unknownResponse = await outsiderAgent
        .post('/api/v1/actions')
        .set('Origin', appOrigin)
        .send(validCreateBody(randomUUID()));

      expect(outOfScopeResponse.status).toBe(404);
      expect(unknownResponse.status).toBe(404);
    });

    it('creation outside the caller scope is audited with a DENIED-equivalent trail: emits a distinct action.created audit event on success', async () => {
      const { agent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const riskId = await createRisk(agent);
      const action = await createActionViaApi(agent, riskId);

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: action.id, action: 'action.created' },
      });
      expect(auditRow).not.toBeNull();
      expect(auditRow?.organizationalUnitId).toBe(orgUnitId);
    });
  });

  // -------------------------------------------------------------------
  // listActions
  // -------------------------------------------------------------------

  describe('GET /actions', () => {
    it('lists actions from two distinct origins for the same responsible in a single page (SC-002)', async () => {
      const { agent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const riskOne = await createRisk(agent);
      const riskTwo = await createRisk(agent);
      await createActionViaApi(agent, riskOne, { title: 'Ação da origem 1' });
      await createActionViaApi(agent, riskTwo, { title: 'Ação da origem 2' });

      const response = await agent
        .get('/api/v1/actions')
        .query({ responsibleUserId })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as ActionPageBody;
      expect(body.items.length).toBeGreaterThanOrEqual(2);
      const origins = new Set(body.items.map((item) => item.originId));
      expect(origins.has(riskOne)).toBe(true);
      expect(origins.has(riskTwo)).toBe(true);
    });

    it('refuses a caller lacking action:view — 403', async () => {
      const { agent } = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/actions').set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('T043: the negation above is audited with a DENIED outcome (FR-030)', async () => {
      const prisma = ctx.app.get(PrismaService);
      const before = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });

      const { agent } = await agentWithPermissions([]);
      await agent.get('/api/v1/actions').set('Origin', appOrigin);

      const after = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });
      expect(after).toBeGreaterThan(before);
    });
  });

  // -------------------------------------------------------------------
  // getAction — scope non-disclosure
  // -------------------------------------------------------------------

  describe('GET /actions/{actionId}', () => {
    it('T043/SC-005: an action outside the caller scope reads as 404, byte-identical to an unknown id', async () => {
      const { agent: ownerAgent } = await agentWithPermissions(
        ['action:create', 'action:view', 'risk:create', 'risk:view', 'risk:treat'],
        otherOrgUnitId,
      );
      const riskId = await createRisk(ownerAgent, otherOrgUnitId);
      const action = await createActionViaApi(ownerAgent, riskId);

      const { agent: outsiderAgent } = await agentWithPermissions(['action:view']);
      const outOfScopeResponse = await outsiderAgent
        .get(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin);
      const unknownResponse = await outsiderAgent
        .get(`/api/v1/actions/${randomUUID()}`)
        .set('Origin', appOrigin);

      expect(outOfScopeResponse.status).toBe(404);
      expect(unknownResponse.status).toBe(404);
    });

    it('T044: an actor may see the action but not its origin — originLabel is simply omitted, the action itself still returns', async () => {
      const { agent: managerAgent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const riskId = await createRisk(managerAgent);
      const action = await createActionViaApi(managerAgent, riskId);

      // A caller with action:view but NO risk:view at all cannot see the
      // origin risk, yet must still be able to read the action.
      const { agent: actionOnlyAgent } = await agentWithPermissions(['action:view']);
      const response = await actionOnlyAgent
        .get(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as ActionBody;
      expect(body.originLabel).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // transitionAction — the five-edge table, reopen, overdue
  // -------------------------------------------------------------------

  describe('POST /actions/{actionId}/transitions', () => {
    async function setup(): Promise<{
      agent: ReturnType<typeof request.agent>;
      action: ActionBody;
    }> {
      const { agent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'action:edit',
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const riskId = await createRisk(agent);
      const action = await createActionViaApi(agent, riskId);
      return { agent, action };
    }

    it('OPEN -> IN_PROGRESS is legal and emits action.started', async () => {
      const { agent, action } = await setup();
      const response = await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      expect(response.status).toBe(200);
      expect((response.body as ActionBody).status).toBe('IN_PROGRESS');

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: action.id, action: 'action.started' },
      });
      expect(auditRow).not.toBeNull();
    });

    it('OPEN -> COMPLETED (skipping IN_PROGRESS) is ILLEGAL — 422', async () => {
      const { agent, action } = await setup();
      const response = await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'COMPLETED' });
      expect(response.status).toBe(422);
    });

    it('IN_PROGRESS -> COMPLETED is legal, stamps completedAt, emits action.completed, and overdue flips to false without a field write', async () => {
      const { agent, action } = await setup();
      // Past due date so the action starts overdue.
      const created = await createActionViaApi(agent, action.originId, { dueOn: '2020-01-01' });
      const started = await agent
        .post(`/api/v1/actions/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      expect(started.status).toBe(200);
      expect((started.body as ActionBody).overdue).toBe(true);

      const completed = await agent
        .post(`/api/v1/actions/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'COMPLETED' });
      expect(completed.status).toBe(200);
      const body = completed.body as ActionBody;
      expect(body.status).toBe('COMPLETED');
      expect(body.completedAt).not.toBeNull();
      // T042 — overdue is computed on read from status/dueOn; completing
      // flips it to false with no `overdue`/`isOverdue` column ever written.
      expect(body.overdue).toBe(false);

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'action.completed' },
      });
      expect(auditRow).not.toBeNull();
    });

    it('OPEN -> CANCELLED and IN_PROGRESS -> CANCELLED are both legal, terminal, and emit action.cancelled', async () => {
      const { agent, action } = await setup();
      const cancelled = await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'CANCELLED' });
      expect(cancelled.status).toBe(200);
      expect((cancelled.body as ActionBody).status).toBe('CANCELLED');

      // CANCELLED is terminal — every further transition is illegal.
      const afterCancel = await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'OPEN', reason: 'Tentativa de reabrir uma ação cancelada.' });
      expect(afterCancel.status).toBe(422);
    });

    it('T041: reopening a COMPLETED action WITHOUT a reason is rejected — 422', async () => {
      const { agent, action } = await setup();
      await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      const completed = await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'COMPLETED' });
      expect(completed.status).toBe(200);

      const reopenAttempt = await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'OPEN' });
      expect(reopenAttempt.status).toBe(422);
    });

    it('T041: reopening WITH a reason succeeds, records action.reopened, preserves the earlier completion in the audit trail, and clears completedAt on the live row', async () => {
      const { agent, action } = await setup();
      await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      const completed = await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'COMPLETED' });
      const completedAt = (completed.body as ActionBody).completedAt;
      expect(completedAt).not.toBeNull();

      const reopened = await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'OPEN', reason: 'Correção incompleta — reabrindo para novo ciclo.' });
      expect(reopened.status).toBe(200);
      const reopenedBody = reopened.body as ActionBody;
      expect(reopenedBody.status).toBe('OPEN');
      // Invariant A1 — completedAt cleared on the LIVE row once status
      // leaves COMPLETED.
      expect(reopenedBody.completedAt).toBeNull();
      expect(reopenedBody.reopenedAt).not.toBeNull();

      const prisma = ctx.app.get(PrismaService);
      const reopenedAuditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: action.id, action: 'action.reopened' },
      });
      expect(reopenedAuditRow).not.toBeNull();
      // The audit row for THIS transition still carries the PREVIOUS
      // completedAt in previousValues — the earlier completion is not lost,
      // only no longer the live value.
      const previousValues = reopenedAuditRow?.previousValues as Record<string, unknown> | null;
      expect(previousValues?.completedAt).toBeTruthy();

      const completedAuditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: action.id, action: 'action.completed' },
      });
      expect(completedAuditRow).not.toBeNull();
    });

    it('T043: reopening without action:edit is rejected and audited', async () => {
      const { agent: managerAgent, action } = await setup();
      await managerAgent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      await managerAgent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'COMPLETED' });

      const { agent: viewerAgent } = await agentWithPermissions(['action:view']);
      const prisma = ctx.app.get(PrismaService);
      const before = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });

      const response = await viewerAgent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'OPEN', reason: 'Sem permissão para isso.' });
      expect(response.status).toBe(403);

      const after = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });
      expect(after).toBeGreaterThan(before);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/actions/${randomUUID()}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // updateAction
  // -------------------------------------------------------------------

  describe('PATCH /actions/{actionId}', () => {
    it('succeeds for a caller holding action:edit and updates the declared fields, never status', async () => {
      const { agent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'action:edit',
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const riskId = await createRisk(agent);
      const action = await createActionViaApi(agent, riskId);

      const response = await agent
        .patch(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Título revisado' });
      expect(response.status).toBe(200);
      expect((response.body as ActionBody).title).toBe('Título revisado');
      expect((response.body as ActionBody).status).toBe('OPEN');
    });

    it('rejects an unknown property (status is not part of UpdateActionRequest) — 400', async () => {
      const { agent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'action:edit',
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const riskId = await createRisk(agent);
      const action = await createActionViaApi(agent, riskId);

      const response = await agent
        .patch(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin)
        .send({ status: 'COMPLETED' });
      expect(response.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // T045a — evidence attached to an Action (EvidenceSubjectType.ACTION)
  // -------------------------------------------------------------------

  describe('Evidence linked to an Action (T045a, FR-017, EvidenceSubjectType.ACTION)', () => {
    it('an evidence record can be linked to an action, proving its execution, and the link is visible from both sides', async () => {
      const { agent, userId } = await agentWithPermissions([
        'action:create',
        'action:view',
        'action:edit',
        'evidence:create',
        'evidence:view',
        'evidence:link',
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const riskId = await createRisk(agent);
      const action = await createActionViaApi(agent, riskId);

      const evidenceResponse = await agent.post('/api/v1/evidence').set('Origin', appOrigin).send({
        orgUnitId,
        title: 'Captura de tela da correção aplicada',
        type: 'SCREENSHOT',
        source: 'MANUAL_UPLOAD',
        ownerUserId: userId,
        collectedOn: '2026-02-15',
        observation: 'Evidência de que a ação foi executada.',
      });
      expect(evidenceResponse.status).toBe(201);
      const evidence = evidenceResponse.body as EvidenceBody;

      const linkResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'ACTION', subjectId: action.id });
      expect(linkResponse.status).toBe(201);
      const linkBody = linkResponse.body as { subjectType: string; subjectLabel?: string };
      expect(linkBody.subjectType).toBe('ACTION');
      expect(linkBody.subjectLabel).toContain(action.code);

      const linksResponse = await agent
        .get(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin);
      expect(linksResponse.status).toBe(200);
      const links = linksResponse.body as readonly { subjectType: string; subjectId: string }[];
      expect(
        links.some((link) => link.subjectType === 'ACTION' && link.subjectId === action.id),
      ).toBe(true);
    });

    it('linking to an action outside the caller scope is refused 404 (FR-032) — the subject side is checked independently of the evidence side', async () => {
      // The action lives in `otherOrgUnitId`, out of the outsider's scope.
      const { agent: ownerAgent } = await agentWithPermissions(
        ['action:create', 'action:view', 'risk:create', 'risk:view', 'risk:treat'],
        otherOrgUnitId,
      );
      const riskId = await createRisk(ownerAgent, otherOrgUnitId);
      const action = await createActionViaApi(ownerAgent, riskId);

      // The outsider's OWN evidence lives in their OWN scope (orgUnitId) —
      // the evidence side of the link is fully authorized; only the
      // subject (ACTION) side is out of scope.
      const { agent: outsiderAgent } = await agentWithPermissions([
        'evidence:link',
        'evidence:view',
        'evidence:create',
        // Holds action:view (so the refusal below is specifically a SCOPE
        // failure, not a missing-permission one) but no scope grant over
        // `otherOrgUnitId`.
        'action:view',
      ]);
      const outsiderEvidence = await outsiderAgent
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send({
          orgUnitId,
          title: 'Evidência do outsider',
          type: 'DOCUMENT',
          source: 'MANUAL_UPLOAD',
          ownerUserId: responsibleUserId,
          collectedOn: '2026-02-15',
          observation: 'x',
        });
      expect(outsiderEvidence.status).toBe(201);

      const response = await outsiderAgent
        .post(`/api/v1/evidence/${(outsiderEvidence.body as EvidenceBody).id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'ACTION', subjectId: action.id });
      expect(response.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------
  // Assurance fix — Action access tracks the origin's LIVE scope, not the
  // creation-time `Action.orgUnitId` snapshot (confirmed breach: an
  // administrator reassigning a risk's org unit used to leave the
  // ORIGINAL custodian with full read/write on the derived Action while
  // 404ing the risk's legitimate NEW custodian).
  // -------------------------------------------------------------------

  describe("Action access follows the origin risk's CURRENT org unit, not a stale snapshot", () => {
    async function setupReassignmentScenario(): Promise<{
      originalCustodianAgent: ReturnType<typeof request.agent>;
      newCustodianAgent: ReturnType<typeof request.agent>;
      action: ActionBody;
      riskId: string;
    }> {
      const custodianPermissions: readonly PermissionIdentifier[] = [
        'action:create',
        'action:view',
        'action:edit',
        'risk:create',
        'risk:view',
        'risk:treat',
      ];

      const { agent: originalCustodianAgent } = await agentWithPermissions(
        custodianPermissions,
        orgUnitId,
      );
      const { agent: newCustodianAgent } = await agentWithPermissions(
        custodianPermissions,
        otherOrgUnitId,
      );

      const riskId = await createRisk(originalCustodianAgent, orgUnitId);
      const action = await createActionViaApi(originalCustodianAgent, riskId);

      // Sanity check — before reassignment, the action is created in
      // `orgUnitId` and readable by the original custodian.
      const before = await originalCustodianAgent
        .get(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin);
      expect(before.status).toBe(200);

      // An administrator with GLOBAL scope moves the RISK (not the
      // action) to the new custodian's unit. `PATCH /risks/{id}` requires
      // `If-Match` (ADR-013) — read the current ETag first.
      const { agent: adminAgent } = await agentWithGlobalScope(['risk:edit', 'risk:view']);
      const riskBeforeReassign = await adminAgent
        .get(`/api/v1/risks/${riskId}`)
        .set('Origin', appOrigin);
      expect(riskBeforeReassign.status).toBe(200);
      const currentETag = riskBeforeReassign.headers.etag!;

      const reassignResponse = await adminAgent
        .patch(`/api/v1/risks/${riskId}`)
        .set('Origin', appOrigin)
        .set('If-Match', currentETag)
        .send({ orgUnitId: otherOrgUnitId });
      expect(reassignResponse.status).toBe(200);

      // The risk itself now correctly reads as 404 for the original
      // custodian and 200 for the new one — establishing the premise the
      // Action-side assertions below are testing against.
      const riskNowHidden = await originalCustodianAgent
        .get(`/api/v1/risks/${riskId}`)
        .set('Origin', appOrigin);
      expect(riskNowHidden.status).toBe(404);
      const riskNowVisible = await newCustodianAgent
        .get(`/api/v1/risks/${riskId}`)
        .set('Origin', appOrigin);
      expect(riskNowVisible.status).toBe(200);

      return { originalCustodianAgent, newCustodianAgent, action, riskId };
    }

    it('GET: the original custodian loses read access once the origin risk moves out of their scope', async () => {
      const { originalCustodianAgent, action } = await setupReassignmentScenario();

      const response = await originalCustodianAgent
        .get(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('GET: the new custodian gains read access once the origin risk moves into their scope', async () => {
      const { newCustodianAgent, action } = await setupReassignmentScenario();

      const response = await newCustodianAgent
        .get(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect((response.body as ActionBody).id).toBe(action.id);
    });

    it('PATCH: the original custodian loses write access once the origin risk moves out of their scope', async () => {
      const { originalCustodianAgent, action } = await setupReassignmentScenario();

      const response = await originalCustodianAgent
        .patch(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Tentativa de edição sem escopo' });
      expect(response.status).toBe(404);
    });

    it('PATCH: the new custodian gains write access once the origin risk moves into their scope', async () => {
      const { newCustodianAgent, action } = await setupReassignmentScenario();

      const response = await newCustodianAgent
        .patch(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Título atualizado pelo novo custodiante' });
      expect(response.status).toBe(200);
      expect((response.body as ActionBody).title).toBe('Título atualizado pelo novo custodiante');
    });

    it('POST transitions: the original custodian loses transition access once the origin risk moves out of their scope', async () => {
      const { originalCustodianAgent, action } = await setupReassignmentScenario();

      const response = await originalCustodianAgent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      expect(response.status).toBe(404);
    });

    it('POST transitions: the new custodian gains transition access once the origin risk moves into their scope', async () => {
      const { newCustodianAgent, action } = await setupReassignmentScenario();

      const response = await newCustodianAgent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      expect(response.status).toBe(200);
      expect((response.body as ActionBody).status).toBe('IN_PROGRESS');
    });

    // Fix 1 — the residual from this same assurance fix: `ListActionUseCase`
    // still filtered on `Action.orgUnitId`'s stale snapshot, so the FORMER
    // custodian could still SEE the action (its code and title) in a list
    // even though direct GET/PATCH/transition on it already 404'd above.
    it('LIST: the former custodian no longer sees the action once the origin risk moves out of their scope', async () => {
      const { originalCustodianAgent, action, riskId } = await setupReassignmentScenario();

      const response = await originalCustodianAgent
        .get('/api/v1/actions')
        .query({ originId: riskId })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as ActionPageBody;
      expect(body.items.map((item) => item.id)).not.toContain(action.id);
    });

    it('LIST: the new custodian sees the action once the origin risk moves into their scope', async () => {
      const { newCustodianAgent, action, riskId } = await setupReassignmentScenario();

      const response = await newCustodianAgent
        .get('/api/v1/actions')
        .query({ originId: riskId })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as ActionPageBody;
      expect(body.items.map((item) => item.id)).toContain(action.id);
    });
  });

  // -------------------------------------------------------------------
  // 008-incidents-problems, US3 — coordinator finding, 2026-09-11:
  // `INCIDENT`/`PROBLEM` were fully wired at the domain level (resolvers
  // registered, `test/unit/action-model-convergence-guard.spec.ts` green)
  // while `CreateActionRequestDto`'s own hand-typed allow-list still named
  // only `RISK_TREATMENT`/`FINDING`, so `POST /actions` rejected both new
  // origins with a flat 400 — a mechanism that compiled and was never
  // exercised end to end (CLAUDE.md §19.10). Fixed by deriving
  // `ACTION_ORIGIN_TYPE_VALUES` from `ActionOriginType` at runtime instead
  // of restating it (which also silently repaired `CONTROL_ASSESSMENT`,
  // missing from that same list since 003-controls-management). These two
  // cases prove the fix AT THE ROUTE, the layer a use-case-level test
  // cannot reach — an accessor test proves the domain agrees with the
  // enum; only a real HTTP POST proves the request validator does too.
  // -------------------------------------------------------------------

  describe('POST /actions accepts every ActionOriginType the schema declares (not a hand-restated subset)', () => {
    it('originType: INCIDENT is accepted end to end through the real route', async () => {
      const { agent, userId } = await agentWithPermissions([
        'action:create',
        'action:view',
        'incident:create',
        'incident:view',
        'incident:edit',
      ]);
      const incidentResponse = await agent.post('/api/v1/incidents').set('Origin', appOrigin).send({
        title: 'Incidente de teste para ação',
        description: 'Descrição do incidente.',
        severity: 'HIGH',
        orgUnitId,
        reportedOn: '2026-02-01',
        ownerUserId: userId,
      });
      expect(incidentResponse.status).toBe(201);
      const incidentId = (incidentResponse.body as { id: string }).id;

      const response = await agent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'INCIDENT',
        originId: incidentId,
        title: 'Ação corretiva do incidente',
        responsibleUserId,
        dueOn: '2035-03-01',
      });
      expect(response.status).toBe(201);
      const action = response.body as ActionBody;
      expect(action.originType).toBe('INCIDENT');
      expect(action.originId).toBe(incidentId);
    });

    it('originType: PROBLEM is accepted end to end through the real route', async () => {
      const { agent, userId } = await agentWithPermissions([
        'action:create',
        'action:view',
        'problem:create',
        'problem:view',
        'problem:edit',
      ]);
      const problemResponse = await agent.post('/api/v1/problems').set('Origin', appOrigin).send({
        title: 'Problema de teste para ação',
        description: 'Descrição do problema.',
        severity: 'HIGH',
        orgUnitId,
        identifiedOn: '2026-02-01',
        ownerUserId: userId,
      });
      expect(problemResponse.status).toBe(201);
      const problemId = (problemResponse.body as { id: string }).id;

      const response = await agent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'PROBLEM',
        originId: problemId,
        title: 'Ação corretiva do problema',
        responsibleUserId,
        dueOn: '2035-03-01',
      });
      expect(response.status).toBe(201);
      const action = response.body as ActionBody;
      expect(action.originType).toBe('PROBLEM');
      expect(action.originId).toBe(problemId);
    });
  });
});
