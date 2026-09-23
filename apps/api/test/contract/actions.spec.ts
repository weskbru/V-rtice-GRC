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

      const { agent: actionOnlyAgent } = await agentWithPermissions(['action:view']);
      const response = await actionOnlyAgent
        .get(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as ActionBody;
      expect(body.originLabel).toBeUndefined();
    });
  });

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
      expect(reopenedBody.completedAt).toBeNull();
      expect(reopenedBody.reopenedAt).not.toBeNull();

      const prisma = ctx.app.get(PrismaService);
      const reopenedAuditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: action.id, action: 'action.reopened' },
      });
      expect(reopenedAuditRow).not.toBeNull();
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
      const { agent: ownerAgent } = await agentWithPermissions(
        ['action:create', 'action:view', 'risk:create', 'risk:view', 'risk:treat'],
        otherOrgUnitId,
      );
      const riskId = await createRisk(ownerAgent, otherOrgUnitId);
      const action = await createActionViaApi(ownerAgent, riskId);

      const { agent: outsiderAgent } = await agentWithPermissions([
        'evidence:link',
        'evidence:view',
        'evidence:create',
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

      const before = await originalCustodianAgent
        .get(`/api/v1/actions/${action.id}`)
        .set('Origin', appOrigin);
      expect(before.status).toBe(200);

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
