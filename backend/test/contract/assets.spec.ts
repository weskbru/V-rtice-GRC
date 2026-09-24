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
  readonly title?: string;
  readonly detail?: string;
}

interface AssetOrgUnitRefBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

interface AssetSummaryBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly orgUnit: AssetOrgUnitRefBody | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

interface AssetDetailBody extends AssetSummaryBody {
  readonly description: string | null;
  readonly risks: readonly { readonly id: string; readonly code: string; readonly title: string }[];
  readonly controls: readonly {
    readonly id: string;
    readonly code: string;
    readonly name: string;
  }[];
  readonly createdAt: string;
}

interface CatalogPageBody {
  readonly data: readonly AssetSummaryBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

describe('Asset catalog and record (006-assets-processes, User Story 1, operations 1-6)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
    unitId: string = orgUnitId,
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('asset-catalog-actor')}@example.test`,
      primaryOrgUnitId: unitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-asset-catalog-role-${randomUUID()}`,
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

  async function createAsset(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<AssetDetailBody> {
    const response = await agent
      .post('/api/v1/assets')
      .set('Origin', appOrigin)
      .send({
        name: 'Servidor de aplicação de teste',
        description: 'Descrição do ativo de teste.',
        orgUnitId,
        ...overrides,
      });
    expect(response.status).toBe(201);
    return response.body as AssetDetailBody;
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('asset-catalog') });
    orgUnitId = orgUnit.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /assets (createAsset)', () => {
    it('creates an active asset with a server-generated AST- code, Location header, and empty risks/controls', async () => {
      const agent = await agentWithPermissions(['asset:create']);
      const response = await agent
        .post('/api/v1/assets')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('asset-create'),
          description: 'Um ativo novo.',
          orgUnitId,
        });

      expect(response.status).toBe(201);
      const body = response.body as AssetDetailBody;
      expect(body.code).toMatch(/^AST-\d{4}-\d{4,}$/);
      expect(body.isActive).toBe(true);
      expect(body.risks).toEqual([]);
      expect(body.controls).toEqual([]);
      expect(body.orgUnit?.id).toBe(orgUnitId);
      expect(response.headers.location).toContain(body.id);
    });

    it('Invariant A3: two assets with the SAME name coexist, with distinct codes', async () => {
      const agent = await agentWithPermissions(['asset:create']);
      const sharedName = uniqueTestMarker('asset-same-name');

      const first = await createAsset(agent, { name: sharedName });
      const second = await createAsset(agent, { name: sharedName });

      expect(first.id).not.toBe(second.id);
      expect(first.code).not.toBe(second.code);
      expect(first.name).toBe(sharedName);
      expect(second.name).toBe(sharedName);
    });

    it('Invariant A6: a client-supplied code is rejected as an unknown property — 400', async () => {
      const agent = await agentWithPermissions(['asset:create']);
      const response = await agent.post('/api/v1/assets').set('Origin', appOrigin).send({
        name: 'Ativo inválido',
        description: 'Descrição.',
        orgUnitId,
        code: 'AST-2026-9999',
      });
      expect(response.status).toBe(400);
    });

    it('Invariant A6: a client-supplied isActive is rejected as an unknown property — 400', async () => {
      const agent = await agentWithPermissions(['asset:create']);
      const response = await agent.post('/api/v1/assets').set('Origin', appOrigin).send({
        name: 'Ativo inválido',
        description: 'Descrição.',
        orgUnitId,
        isActive: false,
      });
      expect(response.status).toBe(400);
    });

    it('Invariant A1/A2: refuses creation into an organizational unit outside the caller scope — 422', async () => {
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('asset-catalog-other'),
      });
      const agent = await agentWithPermissions(['asset:create']);
      const response = await agent.post('/api/v1/assets').set('Origin', appOrigin).send({
        name: 'Ativo fora de escopo',
        description: 'Descrição.',
        orgUnitId: otherUnit.id,
      });
      expect(response.status).toBe(422);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const agent = await agentWithPermissions([]);
      const response = await agent
        .post('/api/v1/assets')
        .set('Origin', appOrigin)
        .send({ name: 'Ativo', description: 'Descrição.', orgUnitId });
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/assets')
        .set('Origin', appOrigin)
        .send({ name: 'Ativo', description: 'Descrição.', orgUnitId });
      expect(response.status).toBe(401);
    });

    it('creation is audited with the new values, including the generated code and orgUnitId', async () => {
      const agent = await agentWithPermissions(['asset:create']);
      const created = await createAsset(agent, { name: uniqueTestMarker('asset-audit-create') });

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'asset.created' },
      });
      expect(event).not.toBeNull();
      const newValues = event?.newValues as Record<string, unknown> | null;
      expect(newValues?.code).toBe(created.code);
      expect(newValues?.orgUnitId).toBe(orgUnitId);
    });
  });

  describe('GET /assets/{assetId} (getAsset)', () => {
    it('returns the asset, including empty risks/controls arrays for a fresh record', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:view']);
      const created = await createAsset(agent);

      const response = await agent.get(`/api/v1/assets/${created.id}`).set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as AssetDetailBody;
      expect(body.id).toBe(created.id);
      expect(body.risks).toEqual([]);
      expect(body.controls).toEqual([]);
    });

    it('an out-of-scope asset and a nonexistent asset answer with identical 404 problem bodies (FR-010)', async () => {
      const inScopeAgent = await agentWithPermissions(['asset:create']);
      const created = await createAsset(inScopeAgent);

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('asset-catalog-scope-b'),
      });
      const outsideAgent = await agentWithPermissions(['asset:view'], otherUnit.id);

      const responseForReal = await outsideAgent
        .get(`/api/v1/assets/${created.id}`)
        .set('Origin', appOrigin);
      const responseForFake = await outsideAgent
        .get(`/api/v1/assets/${randomUUID()}`)
        .set('Origin', appOrigin);

      expect(responseForReal.status).toBe(404);
      expect(responseForFake.status).toBe(404);
      const bodyReal = responseForReal.body as ProblemBody;
      const bodyFake = responseForFake.body as ProblemBody;
      expect(bodyReal.status).toBe(bodyFake.status);
      expect(bodyReal.title).toBe(bodyFake.title);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['asset:create']);
      const created = await createAsset(creator);
      const zeroAgent = await agentWithPermissions([]);
      const response = await zeroAgent.get(`/api/v1/assets/${created.id}`).set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(`/api/v1/assets/${randomUUID()}`);
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /assets/{assetId} (updateAsset)', () => {
    it('updates name/description and audits previous AND new values', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:view', 'asset:edit']);
      const created = await createAsset(agent, { description: 'Descrição original.' });

      const response = await agent
        .patch(`/api/v1/assets/${created.id}`)
        .set('Origin', appOrigin)
        .send({ name: 'Nome atualizado', description: 'Descrição atualizada.' });

      expect(response.status).toBe(200);
      const body = response.body as AssetDetailBody;
      expect(body.name).toBe('Nome atualizado');
      expect(body.description).toBe('Descrição atualizada.');

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'asset.updated' },
      });
      expect(event).not.toBeNull();
      const previousValues = event?.previousValues as Record<string, unknown> | null;
      const newValues = event?.newValues as Record<string, unknown> | null;
      expect(previousValues?.name).toBe(created.name);
      expect(previousValues?.description).toBe('Descrição original.');
      expect(newValues?.name).toBe('Nome atualizado');
      expect(newValues?.description).toBe('Descrição atualizada.');
    });

    it('Invariant A6: code and isActive are read-only and rejected as unknown properties — 400', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:edit']);
      const created = await createAsset(agent);

      const codeResponse = await agent
        .patch(`/api/v1/assets/${created.id}`)
        .set('Origin', appOrigin)
        .send({ code: 'AST-2026-0001' });
      expect(codeResponse.status).toBe(400);

      const isActiveResponse = await agent
        .patch(`/api/v1/assets/${created.id}`)
        .set('Origin', appOrigin)
        .send({ isActive: false });
      expect(isActiveResponse.status).toBe(400);
    });

    it('rejects an empty body with 400', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:edit']);
      const created = await createAsset(agent);

      const response = await agent
        .patch(`/api/v1/assets/${created.id}`)
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(400);
    });

    it('reassignment into an out-of-scope organizational unit is refused with 422 (Invariant A2)', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:edit']);
      const created = await createAsset(agent);
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('asset-catalog-reassign'),
      });

      const response = await agent
        .patch(`/api/v1/assets/${created.id}`)
        .set('Origin', appOrigin)
        .send({ orgUnitId: otherUnit.id });
      expect(response.status).toBe(422);
    });

    it('moving an asset between units does not affect an existing link (spec Assumption A-4)', async () => {
      const prisma = ctx.app.get(PrismaService);
      const fixture = await createLocalUserFixture(prisma, {
        email: `${uniqueTestMarker('asset-reassign-actor')}@example.test`,
        primaryOrgUnitId: orgUnitId,
      });
      const role = await createRoleWithPermissionsFixture(
        prisma,
        [
          'asset:create',
          'asset:edit',
          'asset:view',
          'control:create',
          'control:view',
          'control:edit',
        ],
        { name: `fixture-asset-reassign-role-${randomUUID()}` },
      );
      await assignRoleFixture(prisma, { user: fixture.user, role });
      await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

      const destinationUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('asset-reassign-target'),
      });
      await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: destinationUnit.id });

      const agent = request.agent(ctx.app.getHttpServer());
      const loginResponse = await agent
        .post('/api/v1/auth/login')
        .set('Origin', appOrigin)
        .send({ email: fixture.user.email, password: fixture.rawPassword });
      expect(loginResponse.status).toBe(200);

      const created = await createAsset(agent);
      const controlResponse = await agent
        .post('/api/v1/controls')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('asset-reassign-control'),
          description: 'Controle de teste.',
          orgUnitId,
        });
      expect(controlResponse.status).toBe(201);
      const controlId = (controlResponse.body as { id: string }).id;

      const linkResponse = await agent
        .post(`/api/v1/controls/${controlId}/assets`)
        .set('Origin', appOrigin)
        .send({ id: created.id });
      expect(linkResponse.status).toBe(201);

      const moveResponse = await agent
        .patch(`/api/v1/assets/${created.id}`)
        .set('Origin', appOrigin)
        .send({ orgUnitId: destinationUnit.id });
      expect(moveResponse.status).toBe(200);
      expect((moveResponse.body as AssetDetailBody).orgUnit?.id).toBe(destinationUnit.id);

      const assetDetail = await agent.get(`/api/v1/assets/${created.id}`).set('Origin', appOrigin);
      expect((assetDetail.body as AssetDetailBody).controls).toHaveLength(1);
      const controlLinks = await agent
        .get(`/api/v1/controls/${controlId}/assets`)
        .set('Origin', appOrigin);
      expect((controlLinks.body as unknown[]).length).toBe(1);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['asset:create']);
      const created = await createAsset(creator);
      const zeroAgent = await agentWithPermissions([]);
      const response = await zeroAgent
        .patch(`/api/v1/assets/${created.id}`)
        .set('Origin', appOrigin)
        .send({ name: 'x' });
      expect(response.status).toBe(403);
    });
  });

  describe('POST /assets/{assetId}/deactivate and /reactivate', () => {
    it('deactivates an active asset, and the transition is audited', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:view', 'asset:administer']);
      const created = await createAsset(agent);

      const response = await agent
        .post(`/api/v1/assets/${created.id}/deactivate`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect((response.body as AssetDetailBody).isActive).toBe(false);

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'asset.deactivated' },
      });
      expect(event).not.toBeNull();
    });

    it('deactivating an already-inactive asset is refused with 422, nothing changes', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:view', 'asset:administer']);
      const created = await createAsset(agent);
      await agent.post(`/api/v1/assets/${created.id}/deactivate`).set('Origin', appOrigin);

      const response = await agent
        .post(`/api/v1/assets/${created.id}/deactivate`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(422);

      const current = await agent.get(`/api/v1/assets/${created.id}`).set('Origin', appOrigin);
      expect((current.body as AssetDetailBody).isActive).toBe(false);
    });

    it('reactivates an inactive asset, and BOTH transitions appear in the audit trail', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:view', 'asset:administer']);
      const created = await createAsset(agent);
      await agent.post(`/api/v1/assets/${created.id}/deactivate`).set('Origin', appOrigin);

      const response = await agent
        .post(`/api/v1/assets/${created.id}/reactivate`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect((response.body as AssetDetailBody).isActive).toBe(true);

      const prisma = ctx.app.get(PrismaService);
      const deactivatedEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'asset.deactivated' },
      });
      const reactivatedEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'asset.reactivated' },
      });
      expect(deactivatedEvent).not.toBeNull();
      expect(reactivatedEvent).not.toBeNull();
    });

    it('reactivating an already-active asset is refused with 422, nothing changes', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:view', 'asset:administer']);
      const created = await createAsset(agent);

      const response = await agent
        .post(`/api/v1/assets/${created.id}/reactivate`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(422);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['asset:create']);
      const created = await createAsset(creator);
      const zeroAgent = await agentWithPermissions([]);
      const response = await zeroAgent
        .post(`/api/v1/assets/${created.id}/deactivate`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('SC-007: a deactivated asset stays readable and stays visible in a link created before deactivation, but a NEW link to it is refused', async () => {
      const agent = await agentWithPermissions([
        'asset:create',
        'asset:view',
        'asset:administer',
        'control:create',
        'control:view',
        'control:edit',
      ]);
      const asset = await createAsset(agent, { name: uniqueTestMarker('asset-sc007') });

      const firstControlResponse = await agent
        .post('/api/v1/controls')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('asset-sc007-control-1'),
          description: 'Controle de teste.',
          orgUnitId,
        });
      expect(firstControlResponse.status).toBe(201);
      const firstControlId = (firstControlResponse.body as { id: string }).id;

      const linkResponse = await agent
        .post(`/api/v1/controls/${firstControlId}/assets`)
        .set('Origin', appOrigin)
        .send({ id: asset.id });
      expect(linkResponse.status).toBe(201);

      const deactivateResponse = await agent
        .post(`/api/v1/assets/${asset.id}/deactivate`)
        .set('Origin', appOrigin);
      expect(deactivateResponse.status).toBe(200);

      const readAfterDeactivate = await agent
        .get(`/api/v1/assets/${asset.id}`)
        .set('Origin', appOrigin);
      expect(readAfterDeactivate.status).toBe(200);

      expect((readAfterDeactivate.body as AssetDetailBody).controls).toHaveLength(1);
      const existingLinkListing = await agent
        .get(`/api/v1/controls/${firstControlId}/assets`)
        .set('Origin', appOrigin);
      expect(existingLinkListing.status).toBe(200);
      expect((existingLinkListing.body as unknown[]).length).toBe(1);

      const secondControlResponse = await agent
        .post('/api/v1/controls')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('asset-sc007-control-2'),
          description: 'Controle de teste.',
          orgUnitId,
        });
      expect(secondControlResponse.status).toBe(201);
      const secondControlId = (secondControlResponse.body as { id: string }).id;

      const newLinkResponse = await agent
        .post(`/api/v1/controls/${secondControlId}/assets`)
        .set('Origin', appOrigin)
        .send({ id: asset.id });
      expect(newLinkResponse.status).not.toBe(201);

      const linksOnSecondControl = await agent
        .get(`/api/v1/controls/${secondControlId}/assets`)
        .set('Origin', appOrigin);
      expect((linksOnSecondControl.body as unknown[]).length).toBe(0);
    });

    it('SC-007 (reverse): reactivating restores linkability', async () => {
      const agent = await agentWithPermissions([
        'asset:create',
        'asset:view',
        'asset:administer',
        'control:create',
        'control:view',
        'control:edit',
      ]);
      const asset = await createAsset(agent, { name: uniqueTestMarker('asset-sc007-reverse') });
      await agent.post(`/api/v1/assets/${asset.id}/deactivate`).set('Origin', appOrigin);
      await agent.post(`/api/v1/assets/${asset.id}/reactivate`).set('Origin', appOrigin);

      const controlResponse = await agent
        .post('/api/v1/controls')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('asset-sc007-reverse-control'),
          description: 'Controle de teste.',
          orgUnitId,
        });
      expect(controlResponse.status).toBe(201);
      const controlId = (controlResponse.body as { id: string }).id;

      const linkResponse = await agent
        .post(`/api/v1/controls/${controlId}/assets`)
        .set('Origin', appOrigin)
        .send({ id: asset.id });
      expect(linkResponse.status).toBe(201);
    });
  });

  describe('GET /assets (listAssetCatalog)', () => {
    it('lists an asset within the caller organizational scope, with the AssetSummary shape', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:view']);
      const created = await createAsset(agent, { name: uniqueTestMarker('asset-catalog-list') });

      const response = await agent
        .get('/api/v1/assets')
        .set('Origin', appOrigin)
        .query({ q: created.code });

      expect(response.status).toBe(200);
      const body = response.body as CatalogPageBody;
      expect(body.data).toHaveLength(1);
      const row = body.data[0]!;
      expect(row.id).toBe(created.id);
      expect(row.code).toBe(created.code);
      expect(row.isActive).toBe(true);
      expect(body.meta).toEqual({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
    });

    it('SC-003b: does not list an asset outside the caller organizational scope, and excludes it from the total', async () => {
      const agent = await agentWithPermissions(['asset:create']);
      const created = await createAsset(agent, {
        name: uniqueTestMarker('asset-catalog-scope-excl'),
      });

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('asset-catalog-scope-c'),
      });
      const outsideAgent = await agentWithPermissions(['asset:view'], otherUnit.id);

      const response = await outsideAgent
        .get('/api/v1/assets')
        .set('Origin', appOrigin)
        .query({ q: created.code });

      expect(response.status).toBe(200);
      const body = response.body as CatalogPageBody;
      expect(body.data).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });

    it('T033: an actor scoped to unit A never receives unit B in the body, the total, or pagination', async () => {
      const unitA = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('asset-scope-a'),
      });
      const unitB = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('asset-scope-b'),
      });
      const marker = uniqueTestMarker('asset-scope-pair');

      const agentA = await agentWithPermissions(['asset:create', 'asset:view'], unitA.id);
      const assetA = await createAsset(agentA, { name: `${marker}-a`, orgUnitId: unitA.id });

      const agentB = await agentWithPermissions(['asset:create'], unitB.id);
      const assetB = await createAsset(agentB, { name: `${marker}-b`, orgUnitId: unitB.id });

      const response = await agentA
        .get('/api/v1/assets')
        .set('Origin', appOrigin)
        .query({ q: marker, pageSize: 100 });

      expect(response.status).toBe(200);
      const body = response.body as CatalogPageBody;
      const ids = body.data.map((row) => row.id);
      expect(ids).toContain(assetA.id);
      expect(ids).not.toContain(assetB.id);
      expect(body.meta.total).toBe(1);
      expect(body.meta.totalPages).toBe(1);
    });

    it('filters by isActive', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:view', 'asset:administer']);
      const created = await createAsset(agent, {
        name: uniqueTestMarker('asset-catalog-active-filter'),
      });
      await agent.post(`/api/v1/assets/${created.id}/deactivate`).set('Origin', appOrigin);

      const activeOnly = await agent
        .get('/api/v1/assets')
        .set('Origin', appOrigin)
        .query({ q: created.code, isActive: 'true' });
      expect((activeOnly.body as CatalogPageBody).data).toHaveLength(0);

      const inactiveOnly = await agent
        .get('/api/v1/assets')
        .set('Origin', appOrigin)
        .query({ q: created.code, isActive: 'false' });
      expect((inactiveOnly.body as CatalogPageBody).data).toHaveLength(1);
    });

    it('searches by name', async () => {
      const agent = await agentWithPermissions(['asset:create', 'asset:view']);
      const marker = uniqueTestMarker('asset-catalog-name-search');
      const created = await createAsset(agent, { name: marker });

      const response = await agent
        .get('/api/v1/assets')
        .set('Origin', appOrigin)
        .query({ q: marker });
      expect((response.body as CatalogPageBody).data.map((row) => row.id)).toContain(created.id);
    });

    it('refuses a caller with zero permissions — flat 403 (the one listing exception to the non-disclosure shape)', async () => {
      const agent = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/assets').set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/assets');
      expect(response.status).toBe(401);
    });
  });
});
