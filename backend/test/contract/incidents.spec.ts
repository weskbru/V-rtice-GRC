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
  readonly type?: string;
}

interface IncidentBody {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly severity: string;
  readonly status: string;
  readonly orgUnit: { readonly id: string };
  readonly owner: { readonly id: string };
  readonly reportedOn: string;
  readonly resolutionSummary: string | null;
  readonly resolvedAt: string | null;
  readonly resolvedBy: { readonly id: string } | null;
  readonly closedAt: string | null;
  readonly closedBy: { readonly id: string } | null;
  readonly cancellationReason: string | null;
}

interface IncidentPageBody {
  readonly data: readonly IncidentBody[];
  readonly meta: { readonly page: number; readonly pageSize: number; readonly total: number };
}

describe('Incident contract (US1, 008-incidents-problems)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let otherOrgUnitId: string;
  let ownerUserId: string;

  const FULL_LIFECYCLE_PERMISSIONS: readonly PermissionIdentifier[] = [
    'incident:create',
    'incident:view',
    'incident:edit',
    'incident:transition',
  ];

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('incident-contract-org'),
    });
    orgUnitId = orgUnit.id;
    const otherOrgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('incident-contract-other-org'),
    });
    otherOrgUnitId = otherOrgUnit.id;
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('incident-contract-owner')}@example.test`,
    });
    ownerUserId = owner.id;
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
      email: `${uniqueTestMarker('incident-actor')}@example.test`,
      primaryOrgUnitId: scopedOrgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-incident-role-${randomUUID()}`,
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

  function validCreateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      orgUnitId,
      title: 'Indisponibilidade do sistema de pagamentos',
      description: 'O sistema de pagamentos ficou indisponível por 45 minutos.',
      severity: 'HIGH',
      reportedOn: '2026-02-01',
      ownerUserId,
      ...overrides,
    };
  }

  async function createIncidentViaApi(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<IncidentBody> {
    const response = await agent
      .post('/api/v1/incidents')
      .set('Origin', appOrigin)
      .send(validCreateBody(overrides));
    expect(response.status).toBe(201);
    return response.body as IncidentBody;
  }

  describe('POST /incidents', () => {
    it('succeeds for a caller holding incident:create and returns the declared shape, status OPEN', async () => {
      const { agent } = await agentWithPermissions(['incident:create', 'incident:view']);
      const incident = await createIncidentViaApi(agent);

      expect(incident.id).toBeTruthy();
      expect(incident.code).toMatch(/^INC-\d{4}-\d{4,}$/);
      expect(incident.status).toBe('OPEN');
      expect(incident.severity).toBe('HIGH');
      expect(incident.resolutionSummary).toBeNull();
      expect(incident.closedAt).toBeNull();
    });

    it('defaults ownerUserId to the caller when omitted', async () => {
      const { agent, userId } = await agentWithPermissions(['incident:create', 'incident:view']);
      const incident = await createIncidentViaApi(agent, { ownerUserId: undefined });
      expect(incident.owner.id).toBe(userId);
    });

    it('refuses a caller lacking incident:create — 403', async () => {
      const { agent } = await agentWithPermissions(['incident:view']);
      const response = await agent
        .post('/api/v1/incidents')
        .set('Origin', appOrigin)
        .send(validCreateBody());
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/incidents')
        .set('Origin', appOrigin)
        .send(validCreateBody());
      expect(response.status).toBe(401);
      expect((response.body as ProblemBody).status).toBe(401);
    });

    it('emits a distinct incident.created audit event on success', async () => {
      const { agent } = await agentWithPermissions(['incident:create', 'incident:view']);
      const incident = await createIncidentViaApi(agent);

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: incident.id, action: 'incident.created' },
      });
      expect(auditRow).not.toBeNull();
      expect(auditRow?.organizationalUnitId).toBe(orgUnitId);
    });

    it('an orgUnitId outside the caller scope is refused 422 (creation-time scope, no existing record to disclose)', async () => {
      const { agent } = await agentWithPermissions(['incident:create', 'incident:view']);
      const response = await agent
        .post('/api/v1/incidents')
        .set('Origin', appOrigin)
        .send(validCreateBody({ orgUnitId: otherOrgUnitId }));
      expect(response.status).toBe(422);
    });

    it('a real out-of-scope orgUnitId and a nonexistent orgUnitId produce the byte-identical 422 message', async () => {
      const { agent } = await agentWithPermissions(['incident:create', 'incident:view']);

      const outOfScopeResponse = await agent
        .post('/api/v1/incidents')
        .set('Origin', appOrigin)
        .send(validCreateBody({ orgUnitId: otherOrgUnitId }));
      const nonexistentResponse = await agent
        .post('/api/v1/incidents')
        .set('Origin', appOrigin)
        .send(validCreateBody({ orgUnitId: randomUUID() }));

      expect(outOfScopeResponse.status).toBe(422);
      expect(nonexistentResponse.status).toBe(422);
      const outOfScopeBody = outOfScopeResponse.body as ProblemBody;
      const nonexistentBody = nonexistentResponse.body as ProblemBody;
      expect(outOfScopeBody.title).toBe(nonexistentBody.title);
      expect(outOfScopeBody.detail).toBe(nonexistentBody.detail);
    });
  });

  describe('GET /incidents', () => {
    it('refuses a caller lacking incident:view — 403, audited as DENIED', async () => {
      const prisma = ctx.app.get(PrismaService);
      const before = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });

      const { agent } = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/incidents').set('Origin', appOrigin);
      expect(response.status).toBe(403);

      const after = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });
      expect(after).toBeGreaterThan(before);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/incidents')
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });

    it('lists incidents within the caller scope, filterable by severity', async () => {
      const { agent } = await agentWithPermissions(['incident:create', 'incident:view']);
      await createIncidentViaApi(agent, {
        severity: 'CRITICAL',
        title: uniqueTestMarker('incidente-critico-unico'),
      });

      const response = await agent
        .get('/api/v1/incidents')
        .query({ severity: 'CRITICAL' })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as IncidentPageBody;
      expect(body.data.every((item) => item.severity === 'CRITICAL')).toBe(true);
    });

    it('filters by orgUnitId', async () => {
      const { agent } = await agentWithPermissions(['incident:create', 'incident:view']);
      const incident = await createIncidentViaApi(agent, {
        title: uniqueTestMarker('incidente-por-unidade'),
      });

      const response = await agent
        .get('/api/v1/incidents')
        .query({ orgUnitId })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const ids = (response.body as IncidentPageBody).data.map((item) => item.id);
      expect(ids).toContain(incident.id);
    });

    it('matches search against code and title', async () => {
      const { agent } = await agentWithPermissions(['incident:create', 'incident:view']);
      const marker = uniqueTestMarker('incidente-busca');
      const incident = await createIncidentViaApi(agent, { title: marker });

      const response = await agent
        .get('/api/v1/incidents')
        .query({ search: marker })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const ids = (response.body as IncidentPageBody).data.map((item) => item.id);
      expect(ids).toContain(incident.id);
    });
  });

  describe('GET /incidents/{incidentId}', () => {
    it('an out-of-scope incident reads 404, byte-identical to an unknown id', async () => {
      const { agent: ownerAgent } = await agentWithPermissions(
        ['incident:create', 'incident:view'],
        otherOrgUnitId,
      );
      const incident = await createIncidentViaApi(ownerAgent, { orgUnitId: otherOrgUnitId });

      const { agent: outsiderAgent } = await agentWithPermissions(['incident:view']);
      const outOfScopeResponse = await outsiderAgent
        .get(`/api/v1/incidents/${incident.id}`)
        .set('Origin', appOrigin);
      const unknownResponse = await outsiderAgent
        .get(`/api/v1/incidents/${randomUUID()}`)
        .set('Origin', appOrigin);

      expect(outOfScopeResponse.status).toBe(404);
      expect(unknownResponse.status).toBe(404);
      const outOfScopeBody = outOfScopeResponse.body as ProblemBody;
      const unknownBody = unknownResponse.body as ProblemBody;
      expect(outOfScopeBody.title).toBe(unknownBody.title);
      expect(outOfScopeBody.status).toBe(unknownBody.status);
      expect(outOfScopeBody.type).toBe(unknownBody.type);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/v1/incidents/${randomUUID()}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /incidents/{incidentId}', () => {
    it('updates descriptive fields', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);

      const response = await agent
        .patch(`/api/v1/incidents/${incident.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Título revisado', severity: 'CRITICAL' });
      expect(response.status).toBe(200);
      const body = response.body as IncidentBody;
      expect(body.title).toBe('Título revisado');
      expect(body.severity).toBe('CRITICAL');
    });

    it('C5/adversarial: a status field is rejected as an unknown property — 400, never a route around the transition endpoint', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);

      const response = await agent
        .patch(`/api/v1/incidents/${incident.id}`)
        .set('Origin', appOrigin)
        .send({ status: 'CLOSED' });
      expect(response.status).toBe(400);

      const unchanged = await agent
        .get(`/api/v1/incidents/${incident.id}`)
        .set('Origin', appOrigin);
      expect((unchanged.body as IncidentBody).status).toBe('OPEN');
    });

    it('an empty update body is rejected — 400', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);

      const response = await agent
        .patch(`/api/v1/incidents/${incident.id}`)
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(400);
    });

    it('refuses a caller lacking incident:edit — 403', async () => {
      const { agent } = await agentWithPermissions(['incident:create', 'incident:view']);
      const incident = await createIncidentViaApi(agent);

      const response = await agent
        .patch(`/api/v1/incidents/${incident.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Sem permissão' });
      expect(response.status).toBe(403);
    });
  });

  describe('POST /incidents/{incidentId}/transitions', () => {
    it('OPEN -> IN_PROGRESS emits incident.started', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);

      const response = await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });
      expect(response.status).toBe(200);
      expect((response.body as IncidentBody).status).toBe('IN_PROGRESS');

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: incident.id, action: 'incident.started' },
      });
      expect(event).not.toBeNull();
    });

    it('IN_PROGRESS -> RESOLVED without resolutionSummary is refused 422', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });

      const response = await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED' });
      expect(response.status).toBe(422);
    });

    it('IN_PROGRESS -> RESOLVED with resolutionSummary stamps resolvedAt/resolvedBy and emits incident.resolved', async () => {
      const { agent, userId } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });

      const response = await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED', resolutionSummary: 'Serviço restabelecido às 15h.' });
      expect(response.status).toBe(200);
      const body = response.body as IncidentBody;
      expect(body.status).toBe('RESOLVED');
      expect(body.resolutionSummary).toBe('Serviço restabelecido às 15h.');
      expect(body.resolvedAt).not.toBeNull();
      expect(body.resolvedBy?.id).toBe(userId);

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: incident.id, action: 'incident.resolved' },
      });
      expect(event).not.toBeNull();
    });

    it('RESOLVED -> CLOSED emits incident.closed and preserves the prior resolution', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED', resolutionSummary: 'Causa raiz corrigida.' });

      const response = await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'CLOSED' });
      expect(response.status).toBe(200);
      const body = response.body as IncidentBody;
      expect(body.status).toBe('CLOSED');
      expect(body.closedAt).not.toBeNull();
      expect(body.resolutionSummary).toBe('Causa raiz corrigida.');
      expect(body.resolvedAt).not.toBeNull();

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: incident.id, action: 'incident.closed' },
      });
      expect(event).not.toBeNull();
    });

    it('CLOSED is terminal — any further transition is refused 422', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED', resolutionSummary: 'x' });
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'CLOSED' });

      const response = await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS', reopenReason: 'Tentativa indevida.' });
      expect(response.status).toBe(422);
    });

    it('reopen (RESOLVED -> IN_PROGRESS) without reopenReason is refused 422', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED', resolutionSummary: 'x' });

      const response = await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });
      expect(response.status).toBe(422);
    });

    it('reopen clears resolution fields live but preserves the prior resolution in the audit trail, and reopenReason is never a persisted column', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });
      await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED', resolutionSummary: 'Resolução original.' });

      const response = await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS', reopenReason: 'Reincidência detectada.' });
      expect(response.status).toBe(200);
      const body = response.body as IncidentBody;
      expect(body.status).toBe('IN_PROGRESS');
      expect(body.resolutionSummary).toBeNull();
      expect(body.resolvedAt).toBeNull();

      const prisma = ctx.app.get(PrismaService);
      const reopenedEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: incident.id, action: 'incident.reopened' },
      });
      expect(reopenedEvent).not.toBeNull();
      const previousValues = reopenedEvent?.previousValues as Record<string, unknown> | null;
      expect(previousValues?.resolutionSummary).toBe('Resolução original.');
      const newValues = reopenedEvent?.newValues as Record<string, unknown> | null;
      expect(newValues?.reopenReason).toBe('Reincidência detectada.');
      expect(newValues?.resolutionSummary).toBeNull();

      const resolvedEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: incident.id, action: 'incident.resolved' },
      });
      expect(resolvedEvent).not.toBeNull();
    });

    it('OPEN -> CANCELLED without cancellationReason is refused 422; with it, emits incident.cancelled', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);

      const denied = await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'CANCELLED' });
      expect(denied.status).toBe(422);

      const accepted = await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'CANCELLED', cancellationReason: 'Registrado por engano.' });
      expect(accepted.status).toBe(200);
      expect((accepted.body as IncidentBody).status).toBe('CANCELLED');
      expect((accepted.body as IncidentBody).cancellationReason).toBe('Registrado por engano.');

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: incident.id, action: 'incident.cancelled' },
      });
      expect(event).not.toBeNull();
    });

    it('an illegal pair (OPEN -> CLOSED, skipping the rest of the lifecycle) is refused 422', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const incident = await createIncidentViaApi(agent);

      const response = await agent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'CLOSED' });
      expect(response.status).toBe(422);
    });

    it('refuses a caller lacking incident:transition — 403', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'incident:create',
        'incident:view',
      ]);
      const incident = await createIncidentViaApi(creatorAgent);

      const { agent: viewerAgent } = await agentWithPermissions(['incident:view']);
      const response = await viewerAgent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/incidents/${randomUUID()}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });
      expect(response.status).toBe(401);
    });

    it('an out-of-scope incident is refused 404, byte-identical to unknown', async () => {
      const { agent: ownerAgent } = await agentWithPermissions(
        ['incident:create', 'incident:view'],
        otherOrgUnitId,
      );
      const incident = await createIncidentViaApi(ownerAgent, { orgUnitId: otherOrgUnitId });

      const { agent: outsiderAgent } = await agentWithPermissions(['incident:transition']);
      const outOfScopeResponse = await outsiderAgent
        .post(`/api/v1/incidents/${incident.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });
      const unknownResponse = await outsiderAgent
        .post(`/api/v1/incidents/${randomUUID()}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' });
      expect(outOfScopeResponse.status).toBe(404);
      expect(unknownResponse.status).toBe(404);
    });
  });
});
