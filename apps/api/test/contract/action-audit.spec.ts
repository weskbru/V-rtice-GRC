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

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ActionBody {
  readonly id: string;
}

interface RiskBody {
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

describe('GET /actions/{actionId}/audit-events (listActionAuditEvents)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let otherOrgUnitId: string;
  let responsibleUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const marker = uniqueTestMarker('action-audit-contract');
    const orgUnit = await createOrgUnitFixture(prisma, { code: `${marker}-org` });
    orgUnitId = orgUnit.id;
    const otherOrgUnit = await createOrgUnitFixture(prisma, { code: `${marker}-other-org` });
    otherOrgUnitId = otherOrgUnit.id;
    const responsible = await createUserFixture(prisma, {
      email: `${marker}-responsible@example.test`,
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
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${randomUUID()}@example.test`,
      primaryOrgUnitId: scopedOrgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-action-audit-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: scopedOrgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return agent;
  }

  async function createRiskBackedAction(
    agent: ReturnType<typeof request.agent>,
    riskOrgUnitId: string = orgUnitId,
  ): Promise<string> {
    const riskResponse = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para teste de auditoria de ação (contrato)',
      description: 'Descrição do risco.',
      orgUnitId: riskOrgUnitId,
      ownerUserId: responsibleUserId,
    });
    expect(riskResponse.status).toBe(201);
    const riskId = (riskResponse.body as RiskBody).id;

    const actionResponse = await agent.post('/api/v1/actions').set('Origin', appOrigin).send({
      originType: 'RISK_TREATMENT',
      originId: riskId,
      title: 'Corrigir a lacuna identificada (contrato)',
      responsibleUserId,
      dueOn: '2035-03-01',
    });
    expect(actionResponse.status).toBe(201);
    return (actionResponse.body as ActionBody).id;
  }

  const CREATOR_PERMISSIONS: readonly PermissionIdentifier[] = [
    'action:create',
    'action:view',
    'action:edit',
    'audit:view',
    'risk:create',
    'risk:view',
    'risk:treat',
  ];

  it('succeeds for a caller holding BOTH action:view and audit:view, returning the declared {data, meta} envelope, and includes the action.created audit entry', async () => {
    const agent = await agentWithPermissions(CREATOR_PERMISSIONS);
    const actionId = await createRiskBackedAction(agent);

    const response = await agent
      .get(`/api/v1/actions/${actionId}/audit-events`)
      .set('Origin', appOrigin)
      .query({ page: 1, pageSize: 10 });

    expect(response.status).toBe(200);
    const body = response.body as AuditEventsPageBody;
    expect(body.meta).toEqual({ page: 1, pageSize: 10, total: body.data.length, totalPages: 1 });
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.some((e) => e.action === 'action.created')).toBe(true);
    expect(body.data.every((e) => e.entityType === 'ACTION')).toBe(true);
  });

  it('a caller with action:view but WITHOUT audit:view — who can otherwise see the action — is refused 403 (existence already known, nothing new disclosed)', async () => {
    const creator = await agentWithPermissions(CREATOR_PERMISSIONS);
    const actionId = await createRiskBackedAction(creator);

    const viewerOnly = await agentWithPermissions(['action:view']);
    const response = await viewerOnly
      .get(`/api/v1/actions/${actionId}/audit-events`)
      .set('Origin', appOrigin);

    expect(response.status).toBe(403);
  });

  it('a caller who cannot see the action at all (no action:view) is refused 404, not 403 — the audit:view gate is never reached', async () => {
    const creator = await agentWithPermissions(CREATOR_PERMISSIONS);
    const actionId = await createRiskBackedAction(creator);

    const auditOnly = await agentWithPermissions(['audit:view']);
    const response = await auditOnly
      .get(`/api/v1/actions/${actionId}/audit-events`)
      .set('Origin', appOrigin);

    expect(response.status).toBe(404);
  });

  it('scope-filtered: an action whose origin is outside the caller scope is 404, identical in shape to a nonexistent one', async () => {
    const creator = await agentWithPermissions(
      ['action:create', 'action:view', 'audit:view', 'risk:create', 'risk:view', 'risk:treat'],
      otherOrgUnitId,
    );
    const actionId = await createRiskBackedAction(creator, otherOrgUnitId);

    const outsider = await agentWithPermissions(['action:view', 'audit:view']);
    const outOfScopeResponse = await outsider
      .get(`/api/v1/actions/${actionId}/audit-events`)
      .set('Origin', appOrigin);
    const nonexistentResponse = await outsider
      .get(`/api/v1/actions/${randomUUID()}/audit-events`)
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
      `/api/v1/actions/${randomUUID()}/audit-events`,
    );
    expect(response.status).toBe(401);
  });

  it('paginates: page 1 with pageSize 1 returns exactly one entry and totalPages reflects the full trail', async () => {
    const agent = await agentWithPermissions(CREATOR_PERMISSIONS);
    const actionId = await createRiskBackedAction(agent);
    await agent
      .patch(`/api/v1/actions/${actionId}`)
      .set('Origin', appOrigin)
      .send({ title: 'Título revisado (contrato)' });

    const fullResponse = await agent
      .get(`/api/v1/actions/${actionId}/audit-events`)
      .set('Origin', appOrigin)
      .query({ page: 1, pageSize: 50 });
    expect(fullResponse.status).toBe(200);
    const fullBody = fullResponse.body as AuditEventsPageBody;
    expect(fullBody.data.length).toBeGreaterThanOrEqual(2);

    const pagedResponse = await agent
      .get(`/api/v1/actions/${actionId}/audit-events`)
      .set('Origin', appOrigin)
      .query({ page: 1, pageSize: 1 });
    expect(pagedResponse.status).toBe(200);
    const pagedBody = pagedResponse.body as AuditEventsPageBody;
    expect(pagedBody.data.length).toBe(1);
    expect(pagedBody.meta.total).toBe(fullBody.data.length);
    expect(pagedBody.meta.totalPages).toBe(fullBody.data.length);
  });

  it('shape matches the declared contract: every field the schema names, and never one it does not', async () => {
    const agent = await agentWithPermissions(CREATOR_PERMISSIONS);
    const actionId = await createRiskBackedAction(agent);

    const response = await agent
      .get(`/api/v1/actions/${actionId}/audit-events`)
      .set('Origin', appOrigin)
      .query({ page: 1, pageSize: 10 });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: readonly Record<string, unknown>[];
      meta: Record<string, unknown>;
    };
    expect(Object.keys(body).sort()).toEqual(['data', 'meta']);
    expect(Object.keys(body.meta).sort()).toEqual(['page', 'pageSize', 'total', 'totalPages']);
    const entry = body.data[0]!;
    expect(Object.keys(entry).sort()).toEqual(
      [
        'id',
        'occurredAt',
        'actor',
        'actorLabel',
        'action',
        'entityType',
        'entityId',
        'previousValues',
        'newValues',
        'outcome',
        'ipAddress',
        'userAgent',
        'correlationId',
      ].sort(),
    );
  });

  it('never exposes secrets: no password hash, token, session identifier or internal-only field appears in any audit entry payload', async () => {
    const agent = await agentWithPermissions(CREATOR_PERMISSIONS);
    const actionId = await createRiskBackedAction(agent);

    const response = await agent
      .get(`/api/v1/actions/${actionId}/audit-events`)
      .set('Origin', appOrigin)
      .query({ page: 1, pageSize: 50 });

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body).toLowerCase();
    expect(serialized).not.toMatch(/passwordhash|"hash"|sessionid|"token"|secret/);
  });
});
