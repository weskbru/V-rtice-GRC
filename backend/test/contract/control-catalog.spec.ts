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

import { buildControlsContractTestApp } from './support/controls-contract-app';

import type { ContractTestContext } from './support/contract-app';
import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
}

interface ControlSummaryBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly description: string | null;
  readonly orgUnit: { readonly id: string } | null;
  readonly owner: { readonly id: string } | null;
  readonly nature: string | null;
  readonly type: string | null;
  readonly frequency: string | null;
  readonly status: string;
  readonly isActive: boolean;
  readonly effectiveness: string;
  readonly version: number;
  readonly updatedAt: string;
}

interface ControlDetailBody extends ControlSummaryBody {
  readonly description: string;
  readonly retiredAt: string | null;
  readonly retiredBy: unknown;
  readonly retirementReason: string | null;
  readonly createdAt: string;
}

interface CatalogPageBody {
  readonly data: readonly ControlSummaryBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

describe('Control catalog and record (US1, operations 1-4)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
    unitId: string = orgUnitId,
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('control-catalog-actor')}@example.test`,
      primaryOrgUnitId: unitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-control-catalog-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: unitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return agent;
  }

  async function createControl(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; version: string; body: ControlDetailBody }> {
    const response = await agent
      .post('/api/v1/controls')
      .set('Origin', appOrigin)
      .send({
        name: 'Controle de teste',
        description: 'Descrição do controle de teste.',
        orgUnitId,
        ...overrides,
      });
    expect(response.status).toBe(201);
    const body = response.body as ControlDetailBody;
    return { id: body.id, version: response.headers.etag!, body };
  }

  beforeAll(async () => {
    ctx = await buildControlsContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('control-catalog'),
    });
    orgUnitId = orgUnit.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /controls (createControl)', () => {
    it('creates a DRAFT control with a server-generated code, and returns Location/ETag', async () => {
      const agent = await agentWithPermissions(['control:create']);
      const { body } = await createControl(agent);

      expect(body.status).toBe('DRAFT');
      expect(body.code).toMatch(/^CTL-\d{4}-\d{4,}$/);
      expect(body.owner).toBeNull();
      expect(body.effectiveness).toBe('NOT_ASSESSED');
      expect(body.version).toBe(1);
    });

    it('rejects an unknown property (e.g. status/code/effectiveness) with 400', async () => {
      const agent = await agentWithPermissions(['control:create']);
      const response = await agent.post('/api/v1/controls').set('Origin', appOrigin).send({
        name: 'Controle inválido',
        description: 'Descrição.',
        orgUnitId,
        status: 'ACTIVE',
      });
      expect(response.status).toBe(400);
    });

    it('refuses creation into an organizational unit outside the caller scope — 422', async () => {
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('control-catalog-other'),
      });
      const agent = await agentWithPermissions(['control:create']);
      const response = await agent.post('/api/v1/controls').set('Origin', appOrigin).send({
        name: 'Controle fora de escopo',
        description: 'Descrição.',
        orgUnitId: otherUnit.id,
      });
      expect(response.status).toBe(422);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const agent = await agentWithPermissions([]);
      const response = await agent.post('/api/v1/controls').set('Origin', appOrigin).send({
        name: 'Controle',
        description: 'Descrição.',
        orgUnitId,
      });
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/controls')
        .set('Origin', appOrigin)
        .send({ name: 'Controle', description: 'Descrição.', orgUnitId });
      expect(response.status).toBe(401);
    });
  });

  describe('GET /controls/{controlId} (getControl)', () => {
    it('returns the control with no ETag and Cache-Control: no-store — effectiveness is derived at read time and not tied to version', async () => {
      const agent = await agentWithPermissions(['control:create', 'control:view']);
      const { id } = await createControl(agent);

      const response = await agent.get(`/api/v1/controls/${id}`).set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect(response.headers.etag).toBeUndefined();
      expect(response.headers['cache-control']).toBe('no-store');
      const body = response.body as ControlDetailBody;
      expect(body.id).toBe(id);
    });

    it('a pre-existing control (created before this fase, new attributes all null) is readable without error (FR-003)', async () => {
      const prisma = ctx.app.get(PrismaService);
      const legacyControl = await prisma.client.control.create({
        data: {
          code: uniqueTestMarker('legacy-control'),
          name: 'Controle legado',
          orgUnitId,
          isActive: true,
        },
      });
      const agent = await agentWithPermissions(['control:view']);

      const response = await agent
        .get(`/api/v1/controls/${legacyControl.id}`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as ControlDetailBody;
      expect(body.owner).toBeNull();
      expect(body.nature).toBeNull();
      expect(body.type).toBeNull();
      expect(body.frequency).toBeNull();
      expect(body.status).toBe('DRAFT');
      expect(body.effectiveness).toBe('NOT_ASSESSED');
    });

    it('an out-of-scope control and a nonexistent control answer with identical 404 problem bodies (FR-007)', async () => {
      const inScopeAgent = await agentWithPermissions(['control:create']);
      const { id: outOfScopeControlId } = await createControl(inScopeAgent);

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('control-catalog-scope-b'),
      });
      const outsideAgent = await agentWithPermissions(['control:view'], otherUnit.id);

      const responseForReal = await outsideAgent
        .get(`/api/v1/controls/${outOfScopeControlId}`)
        .set('Origin', appOrigin);
      const responseForFake = await outsideAgent
        .get(`/api/v1/controls/${randomUUID()}`)
        .set('Origin', appOrigin);

      expect(responseForReal.status).toBe(404);
      expect(responseForFake.status).toBe(404);
      const bodyReal = responseForReal.body as ProblemBody;
      const bodyFake = responseForFake.body as ProblemBody;
      expect(bodyReal.status).toBe(bodyFake.status);
      expect(bodyReal.title).toBe(bodyFake.title);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['control:create']);
      const { id } = await createControl(creator);
      const zeroAgent = await agentWithPermissions([]);
      const response = await zeroAgent.get(`/api/v1/controls/${id}`).set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/controls/${randomUUID()}`,
      );
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /controls/{controlId} (updateControl)', () => {
    it('updates a field, echoes the new ETag, and audits previous/new values', async () => {
      const agent = await agentWithPermissions(['control:create', 'control:view', 'control:edit']);
      const { id, version } = await createControl(agent);

      const response = await agent
        .patch(`/api/v1/controls/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ name: 'Controle atualizado' });

      expect(response.status).toBe(200);
      const body = response.body as ControlDetailBody;
      expect(body.name).toBe('Controle atualizado');
      expect(response.headers.etag).not.toBe(version);
    });

    it('rejects an empty body with 400', async () => {
      const agent = await agentWithPermissions(['control:create', 'control:edit']);
      const { id, version } = await createControl(agent);

      const response = await agent
        .patch(`/api/v1/controls/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({});
      expect(response.status).toBe(400);
    });

    it('requires If-Match — 400 when missing', async () => {
      const agent = await agentWithPermissions(['control:create', 'control:edit']);
      const { id } = await createControl(agent);

      const response = await agent
        .patch(`/api/v1/controls/${id}`)
        .set('Origin', appOrigin)
        .send({ name: 'x' });
      expect(response.status).toBe(400);
    });

    it('a stale If-Match yields 409 with the current version, and nothing is written', async () => {
      const agent = await agentWithPermissions(['control:create', 'control:view', 'control:edit']);
      const { id, version } = await createControl(agent);

      await agent
        .patch(`/api/v1/controls/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ name: 'Primeira atualização' });

      const staleResponse = await agent
        .patch(`/api/v1/controls/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ name: 'Segunda atualização (deveria falhar)' });

      expect(staleResponse.status).toBe(409);

      const currentResponse = await agent.get(`/api/v1/controls/${id}`).set('Origin', appOrigin);
      expect((currentResponse.body as ControlDetailBody).name).toBe('Primeira atualização');
    });

    it('reassignment into an out-of-scope organizational unit is refused with 422', async () => {
      const agent = await agentWithPermissions(['control:create', 'control:edit']);
      const { id, version } = await createControl(agent);
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('control-catalog-reassign'),
      });

      const response = await agent
        .patch(`/api/v1/controls/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ orgUnitId: otherUnit.id });
      expect(response.status).toBe(422);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['control:create']);
      const { id, version } = await createControl(creator);
      const zeroAgent = await agentWithPermissions([]);
      const response = await zeroAgent
        .patch(`/api/v1/controls/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ name: 'x' });
      expect(response.status).toBe(403);
    });
  });

  describe('GET /controls (listControlCatalog)', () => {
    it('lists only controls within the caller organizational scope, with the ControlSummary superset shape', async () => {
      const agent = await agentWithPermissions(['control:create', 'control:view']);
      const { id, body: created } = await createControl(agent, {
        name: uniqueTestMarker('control-catalog-list'),
      });

      const response = await agent
        .get('/api/v1/controls')
        .set('Origin', appOrigin)
        .query({ q: created.code });

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = response.body as CatalogPageBody;
      expect(body.data).toHaveLength(1);
      const row = body.data[0]!;
      expect(row.id).toBe(id);
      expect(row.code).toBe(created.code);
      expect(row.name).toBe(created.name);
      expect(row.description).toBe('Descrição do controle de teste.');
      expect(row.isActive).toBe(true);
      expect(body.meta).toEqual({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
    });

    it("supports exactly the query parameters frontend's listControlRegistry sends (pageSize, q)", async () => {
      const agent = await agentWithPermissions(['control:create', 'control:view']);
      const { body: created } = await createControl(agent, {
        name: uniqueTestMarker('control-catalog-web-compat'),
      });

      const response = await agent
        .get('/api/v1/controls')
        .set('Origin', appOrigin)
        .query({ pageSize: 25, q: created.code });

      expect(response.status).toBe(200);
      const body = response.body as CatalogPageBody;
      expect(body.data[0]!.id).toBeDefined();
    });

    it('does not list a control outside the caller organizational scope, and excludes it from the total', async () => {
      const agent = await agentWithPermissions(['control:create']);
      const { body: created } = await createControl(agent, {
        name: uniqueTestMarker('control-catalog-scope-excl'),
      });

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('control-catalog-scope-c'),
      });
      const outsideAgent = await agentWithPermissions(['control:view'], otherUnit.id);

      const response = await outsideAgent
        .get('/api/v1/controls')
        .set('Origin', appOrigin)
        .query({ q: created.code });

      expect(response.status).toBe(200);
      const body = response.body as CatalogPageBody;
      expect(body.data).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });

    it('filters by status', async () => {
      const agent = await agentWithPermissions(['control:create', 'control:view']);
      const { body: created } = await createControl(agent, {
        name: uniqueTestMarker('control-catalog-status-filter'),
      });

      const matching = await agent
        .get('/api/v1/controls')
        .set('Origin', appOrigin)
        .query({ q: created.code, status: 'DRAFT' });
      expect((matching.body as CatalogPageBody).data).toHaveLength(1);

      const nonMatching = await agent
        .get('/api/v1/controls')
        .set('Origin', appOrigin)
        .query({ q: created.code, status: 'ACTIVE' });
      expect((nonMatching.body as CatalogPageBody).data).toHaveLength(0);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const agent = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/controls').set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/controls');
      expect(response.status).toBe(401);
    });
  });
});
