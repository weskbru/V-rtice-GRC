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
import { createLocalUserFixture, createOrgUnitFixture } from '../integration/support/fixtures';

import { buildContractTestApp } from './support/contract-app';

import type { ContractTestContext } from './support/contract-app';
import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
}

interface ProblemDetailBody {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly severity: string;
  readonly status: string;
  readonly orgUnit: { readonly id: string; readonly code: string; readonly name: string };
  readonly owner: { readonly id: string; readonly fullName: string };
  readonly identifiedOn: string;
  readonly rootCause: string | null;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
  readonly cancellationReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ProblemListBody {
  readonly data: readonly ProblemDetailBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

interface ActionBody {
  readonly id: string;
  readonly status: string;
}

describe('Problem catalogue and lifecycle (008-incidents-problems, US2)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
    unitId: string = orgUnitId,
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('problem-actor')}@example.test`,
      primaryOrgUnitId: unitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-problem-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: unitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return { agent, userId: fixture.user.id };
  }

  async function createProblem(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<ProblemDetailBody> {
    const response = await agent
      .post('/api/v1/problems')
      .set('Origin', appOrigin)
      .send({
        title: 'Problema de teste',
        description: 'Descrição do problema de teste.',
        severity: 'MEDIUM',
        orgUnitId,
        identifiedOn: '2026-01-01',
        ...overrides,
      });
    expect(response.status).toBe(201);
    return response.body as ProblemDetailBody;
  }

  async function createCompletedProblemAction(
    completerAgent: ReturnType<typeof request.agent>,
    problemId: string,
    responsibleUserId: string,
  ): Promise<string> {
    const created = await completerAgent.post('/api/v1/actions').set('Origin', appOrigin).send({
      originType: 'PROBLEM',
      originId: problemId,
      title: 'Ação corretiva de teste',
      responsibleUserId,
      dueOn: '2035-03-01',
    });
    expect(created.status).toBe(201);
    const action = created.body as ActionBody;

    const started = await completerAgent
      .post(`/api/v1/actions/${action.id}/transitions`)
      .set('Origin', appOrigin)
      .send({ to: 'IN_PROGRESS' });
    expect(started.status).toBe(200);

    const completed = await completerAgent
      .post(`/api/v1/actions/${action.id}/transitions`)
      .set('Origin', appOrigin)
      .send({ to: 'COMPLETED' });
    expect(completed.status).toBe(200);
    expect((completed.body as ActionBody).status).toBe('COMPLETED');

    return action.id;
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('problem-catalog'),
    });
    orgUnitId = orgUnit.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /problems (createProblem)', () => {
    it('creates an OPEN problem with a server-generated PRB code, defaulting the owner to the caller', async () => {
      const { agent, userId } = await agentWithPermissions(['problem:create', 'problem:view']);
      const body = await createProblem(agent);

      expect(body.code).toMatch(/^PRB-\d{4}-\d{4,}$/);
      expect(body.status).toBe('OPEN');
      expect(body.owner.id).toBe(userId);
      expect(body.rootCause).toBeNull();
      expect(body.closedAt).toBeNull();
    });

    it('rejects an unknown property (e.g. status/code/rootCause) with 400', async () => {
      const { agent } = await agentWithPermissions(['problem:create']);
      const response = await agent.post('/api/v1/problems').set('Origin', appOrigin).send({
        title: 'Problema de teste',
        description: 'Descrição.',
        severity: 'LOW',
        orgUnitId,
        identifiedOn: '2026-01-01',
        status: 'CLOSED',
      });
      expect(response.status).toBe(400);
    });

    it('refuses creation into an organizational unit outside the caller scope — 422', async () => {
      const { agent } = await agentWithPermissions(['problem:create']);
      const outsideUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('problem-outside'),
      });
      const response = await agent.post('/api/v1/problems').set('Origin', appOrigin).send({
        title: 'Problema de teste',
        description: 'Descrição.',
        severity: 'LOW',
        orgUnitId: outsideUnit.id,
        identifiedOn: '2026-01-01',
      });
      expect(response.status).toBe(422);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const { agent } = await agentWithPermissions([]);
      const response = await agent.post('/api/v1/problems').set('Origin', appOrigin).send({
        title: 'Problema de teste',
        description: 'Descrição.',
        severity: 'LOW',
        orgUnitId,
        identifiedOn: '2026-01-01',
      });
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/problems')
        .set('Origin', appOrigin)
        .send({
          title: 'Problema de teste',
          description: 'Descrição.',
          severity: 'LOW',
          orgUnitId,
          identifiedOn: '2026-01-01',
        });
      expect(response.status).toBe(401);
    });
  });

  describe('GET /problems/{problemId} (getProblem)', () => {
    it('returns the problem with its full detail shape', async () => {
      const { agent } = await agentWithPermissions(['problem:create', 'problem:view']);
      const created = await createProblem(agent);

      const response = await agent.get(`/api/v1/problems/${created.id}`).set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect((response.body as ProblemDetailBody).id).toBe(created.id);
    });

    it('an out-of-scope problem and a nonexistent problem answer with identical 404 problem bodies (FR-014)', async () => {
      const creator = await agentWithPermissions(['problem:create', 'problem:view']);
      const created = await createProblem(creator.agent);

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('problem-scope-other'),
      });
      const outsider = await agentWithPermissions(['problem:view'], otherUnit.id);

      const outOfScope = await outsider.agent
        .get(`/api/v1/problems/${created.id}`)
        .set('Origin', appOrigin);
      const nonexistent = await outsider.agent
        .get(`/api/v1/problems/${randomUUID()}`)
        .set('Origin', appOrigin);

      expect(outOfScope.status).toBe(404);
      expect(nonexistent.status).toBe(404);
      expect((outOfScope.body as ProblemBody).title).toBe((nonexistent.body as ProblemBody).title);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['problem:create', 'problem:view']);
      const created = await createProblem(creator.agent);
      const { agent } = await agentWithPermissions([]);
      const response = await agent.get(`/api/v1/problems/${created.id}`).set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/v1/problems/${randomUUID()}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /problems/{problemId} (updateProblem)', () => {
    it('updates a field and echoes it back', async () => {
      const { agent } = await agentWithPermissions([
        'problem:create',
        'problem:view',
        'problem:edit',
      ]);
      const created = await createProblem(agent);

      const response = await agent
        .patch(`/api/v1/problems/${created.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Problema atualizado' });

      expect(response.status).toBe(200);
      expect((response.body as ProblemDetailBody).title).toBe('Problema atualizado');
    });

    it('rejects an empty body with 400', async () => {
      const { agent } = await agentWithPermissions([
        'problem:create',
        'problem:view',
        'problem:edit',
      ]);
      const created = await createProblem(agent);

      const response = await agent
        .patch(`/api/v1/problems/${created.id}`)
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(400);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['problem:create', 'problem:view']);
      const created = await createProblem(creator.agent);
      const { agent } = await agentWithPermissions([]);
      const response = await agent
        .patch(`/api/v1/problems/${created.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Tentativa não autorizada' });
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .patch(`/api/v1/problems/${randomUUID()}`)
        .set('Origin', appOrigin)
        .send({ title: 'x' });
      expect(response.status).toBe(401);
    });
  });

  describe('GET /problems (listProblems)', () => {
    it('lists only problems within the caller organizational scope', async () => {
      const { agent } = await agentWithPermissions(['problem:create', 'problem:view']);
      const created = await createProblem(agent);

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('problem-list-other'),
      });
      const outsider = await agentWithPermissions(['problem:view'], otherUnit.id);

      const response = await outsider.agent.get('/api/v1/problems').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as ProblemListBody;
      expect(body.data.some((item) => item.id === created.id)).toBe(false);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const { agent } = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/problems').set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/problems')
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /problems/{problemId}/transitions (transitionProblem)', () => {
    it('OPEN -> IN_ANALYSIS succeeds with no extra fields', async () => {
      const { agent } = await agentWithPermissions([
        'problem:create',
        'problem:view',
        'problem:transition',
      ]);
      const created = await createProblem(agent);

      const response = await agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_ANALYSIS' });
      expect(response.status).toBe(200);
      expect((response.body as ProblemDetailBody).status).toBe('IN_ANALYSIS');
    });

    it('IN_ANALYSIS -> RESOLVED without rootCause is refused — 422 (Invariant P1)', async () => {
      const { agent } = await agentWithPermissions([
        'problem:create',
        'problem:view',
        'problem:transition',
      ]);
      const created = await createProblem(agent);
      await agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_ANALYSIS' });

      const response = await agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED' });
      expect(response.status).toBe(422);
    });

    it('IN_ANALYSIS -> RESOLVED with rootCause succeeds and stamps resolvedAt', async () => {
      const { agent } = await agentWithPermissions([
        'problem:create',
        'problem:view',
        'problem:transition',
      ]);
      const created = await createProblem(agent);
      await agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_ANALYSIS' });

      const response = await agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED', rootCause: 'Configuração incorreta identificada.' });
      expect(response.status).toBe(200);
      const body = response.body as ProblemDetailBody;
      expect(body.status).toBe('RESOLVED');
      expect(body.rootCause).toBe('Configuração incorreta identificada.');
      expect(body.resolvedAt).not.toBeNull();
    });

    it('an illegal transition (OPEN -> CLOSED) is refused — 422', async () => {
      const { agent } = await agentWithPermissions([
        'problem:create',
        'problem:view',
        'problem:transition',
      ]);
      const created = await createProblem(agent);

      const response = await agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'CLOSED' });
      expect(response.status).toBe(422);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['problem:create', 'problem:view']);
      const created = await createProblem(creator.agent);
      const { agent } = await agentWithPermissions([]);
      const response = await agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_ANALYSIS' });
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/problems/${randomUUID()}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_ANALYSIS' });
      expect(response.status).toBe(401);
    });

    it('RESOLVED -> CLOSED without any completed corrective Action is refused — 422 (Invariant P2)', async () => {
      const { agent } = await agentWithPermissions([
        'problem:create',
        'problem:view',
        'problem:transition',
      ]);
      const created = await createProblem(agent);
      await agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_ANALYSIS' });
      await agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED', rootCause: 'Causa identificada.' });

      const response = await agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'CLOSED' });
      expect(response.status).toBe(422);
    });

    it('the user who completed the corrective Action may not close the problem — 403 (Invariant P3, segregation of duties)', async () => {
      const owner = await agentWithPermissions([
        'problem:create',
        'problem:view',
        'problem:transition',
        'problem:edit',
        'action:create',
        'action:view',
        'action:edit',
      ]);
      const created = await createProblem(owner.agent);
      await owner.agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_ANALYSIS' });
      await owner.agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED', rootCause: 'Causa identificada.' });

      await createCompletedProblemAction(owner.agent, created.id, owner.userId);

      const response = await owner.agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'CLOSED' });
      expect(response.status).toBe(403);
    });

    it('a DIFFERENT user closes successfully once a completed corrective Action exists', async () => {
      const owner = await agentWithPermissions([
        'problem:create',
        'problem:view',
        'problem:transition',
        'problem:edit',
        'action:create',
        'action:view',
        'action:edit',
      ]);
      const created = await createProblem(owner.agent);
      await owner.agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_ANALYSIS' });
      await owner.agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'RESOLVED', rootCause: 'Causa identificada.' });

      await createCompletedProblemAction(owner.agent, created.id, owner.userId);

      const closer = await agentWithPermissions(['problem:view', 'problem:transition']);
      const response = await closer.agent
        .post(`/api/v1/problems/${created.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'CLOSED' });
      expect(response.status).toBe(200);
      const body = response.body as ProblemDetailBody;
      expect(body.status).toBe('CLOSED');
      expect(body.closedAt).not.toBeNull();
    });
  });
});
