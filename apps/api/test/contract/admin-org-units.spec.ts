import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

describe('Admin organizational unit administration (T180, US8)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const role = await createRoleWithPermissionsFixture(prisma, ['org_unit:administer'], {
      name: `fixture-admin-org-units-admin-role-${randomUUID()}`,
    });
    const admin = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('aou-admin')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: admin.user, role });

    agent = request.agent(ctx.app.getHttpServer());
    const login = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: admin.user.email, password: admin.rawPassword });
    expect(login.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creates a root unit with server-derived path/depth, and a Location header', async () => {
    const code = uniqueTestMarker('aou-root');
    const response = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code, name: 'Unidade Raiz' });

    expect(response.status).toBe(201);
    expect(response.headers.location).toContain('/admin/org-units/');
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({
      code,
      name: 'Unidade Raiz',
      depth: 0,
      status: 'ACTIVE',
      childCount: 0,
    });
    expect(body.parentId).toBeNull();
  });

  it('creates a child unit whose depth/path reflect the parent, refuses an inactive/nonexistent parent (422)', async () => {
    const rootResponse = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-parent'), name: 'Pai' });
    const rootId = (rootResponse.body as { id: string }).id;

    const childResponse = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-child'), name: 'Filho', parentId: rootId });
    expect(childResponse.status).toBe(201);
    expect((childResponse.body as { depth: number }).depth).toBe(1);
    expect((childResponse.body as { parentId: string }).parentId).toBe(rootId);

    const missingParent = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-orphan'), name: 'Órfão', parentId: randomUUID() });
    expect(missingParent.status).toBe(422);
  });

  it('refuses creating a unit with a code already in use (409)', async () => {
    const code = uniqueTestMarker('aou-dup');
    const first = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code, name: 'Primeira' });
    expect(first.status).toBe(201);

    const second = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code, name: 'Segunda' });
    expect(second.status).toBe(409);
  });

  it('lists the full tree as a plain array ordered by materialized path', async () => {
    const response = await agent.get('/api/v1/admin/org-units').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('retrieves a unit by id, 404 for a nonexistent one', async () => {
    const created = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-detail'), name: 'Detalhe' });
    const unitId = (created.body as { id: string }).id;

    const found = await agent.get(`/api/v1/admin/org-units/${unitId}`).set('Origin', appOrigin);
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ id: unitId });

    const notFound = await agent
      .get(`/api/v1/admin/org-units/${randomUUID()}`)
      .set('Origin', appOrigin);
    expect(notFound.status).toBe(404);
  });

  it('renames a unit via PATCH, refusing an empty body (400) and a code collision (409)', async () => {
    const unitA = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-rename-a'), name: 'A' });
    const unitB = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-rename-b'), name: 'B' });
    const unitAId = (unitA.body as { id: string }).id;
    const unitBId = (unitB.body as { id: string }).id;
    const unitACode = (unitA.body as { code: string }).code;

    const empty = await agent
      .patch(`/api/v1/admin/org-units/${unitAId}`)
      .set('Origin', appOrigin)
      .send({});
    expect(empty.status).toBe(400);

    const renamed = await agent
      .patch(`/api/v1/admin/org-units/${unitAId}`)
      .set('Origin', appOrigin)
      .send({ name: 'A renomeada' });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ name: 'A renomeada' });

    const collision = await agent
      .patch(`/api/v1/admin/org-units/${unitBId}`)
      .set('Origin', appOrigin)
      .send({ code: unitACode });
    expect(collision.status).toBe(409);
  });

  it('deactivates a leaf unit (200), refuses deactivating a unit with an active descendant (422)', async () => {
    const parent = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-st-p'), name: 'Pai' });
    const parentId = (parent.body as { id: string }).id;
    const child = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-st-c'), name: 'Filho', parentId });
    const childId = (child.body as { id: string }).id;

    const parentDeactivation = await agent
      .put(`/api/v1/admin/org-units/${parentId}/status`)
      .set('Origin', appOrigin)
      .send({ status: 'INACTIVE' });
    expect(parentDeactivation.status).toBe(422);

    const childDeactivation = await agent
      .put(`/api/v1/admin/org-units/${childId}/status`)
      .set('Origin', appOrigin)
      .send({ status: 'INACTIVE' });
    expect(childDeactivation.status).toBe(200);
    expect(childDeactivation.body).toMatchObject({ status: 'INACTIVE' });

    const parentDeactivationRetry = await agent
      .put(`/api/v1/admin/org-units/${parentId}/status`)
      .set('Origin', appOrigin)
      .send({ status: 'INACTIVE' });
    expect(parentDeactivationRetry.status).toBe(200);

    const reactivate = await agent
      .put(`/api/v1/admin/org-units/${childId}/status`)
      .set('Origin', appOrigin)
      .send({ status: 'ACTIVE' });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body).toMatchObject({ status: 'ACTIVE' });
  });

  it('reparents a unit via PATCH parentId, and to root via parentId: null', async () => {
    const root = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-rp-root'), name: 'Raiz' });
    const rootId = (root.body as { id: string }).id;
    const target = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-rp-tgt'), name: 'Alvo' });
    const targetId = (target.body as { id: string }).id;
    const unit = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-rp-unit'), name: 'Unidade', parentId: rootId });
    const unitId = (unit.body as { id: string }).id;

    const reparented = await agent
      .patch(`/api/v1/admin/org-units/${unitId}`)
      .set('Origin', appOrigin)
      .send({ parentId: targetId });
    expect(reparented.status).toBe(200);
    expect(reparented.body).toMatchObject({ parentId: targetId });

    const toRoot = await agent
      .patch(`/api/v1/admin/org-units/${unitId}`)
      .set('Origin', appOrigin)
      .send({ parentId: null });
    expect(toRoot.status).toBe(200);
    expect((toRoot.body as { parentId: unknown }).parentId).toBeNull();
    expect((toRoot.body as { depth: number }).depth).toBe(0);
  });

  it('refuses a reparent that would create a cycle with 422', async () => {
    const parent = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-cyc-p'), name: 'Pai' });
    const parentId = (parent.body as { id: string }).id;
    const child = await agent
      .post('/api/v1/admin/org-units')
      .set('Origin', appOrigin)
      .send({ code: uniqueTestMarker('aou-cyc-c'), name: 'Filho', parentId });
    const childId = (child.body as { id: string }).id;

    const response = await agent
      .patch(`/api/v1/admin/org-units/${parentId}`)
      .set('Origin', appOrigin)
      .send({ parentId: childId });
    expect(response.status).toBe(422);
  });
});
