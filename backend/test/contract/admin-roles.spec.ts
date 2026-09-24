import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createPermissionFixture,
  createRoleWithPermissionsFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

describe('Admin role and permission administration (T180, US8)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    await createPermissionFixture(prisma, 'risk:view');
    await createPermissionFixture(prisma, 'risk:create');
    const role = await createRoleWithPermissionsFixture(prisma, ['role:administer'], {
      name: `fixture-admin-roles-admin-role-${randomUUID()}`,
    });
    const admin = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('ar-admin')}@example.test`,
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

  it('lists the seeded-style permission catalogue, and can filter by resource', async () => {
    const response = await agent.get('/api/v1/admin/permissions').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    const identifiers = (response.body as { identifier: string }[]).map((p) => p.identifier);
    expect(identifiers).toContain('role:administer');

    const filtered = await agent
      .get('/api/v1/admin/permissions')
      .query({ resource: 'role' })
      .set('Origin', appOrigin);
    expect(filtered.status).toBe(200);
    for (const permission of filtered.body as { resource: string }[]) {
      expect(permission.resource).toBe('role');
    }
  });

  it('creates a role with the declared Role shape and a Location header', async () => {
    const name = `Fixture Role ${uniqueTestMarker('name')}`;
    const response = await agent
      .post('/api/v1/admin/roles')
      .set('Origin', appOrigin)
      .send({
        name,
        description: 'Papel de teste.',
        permissionIdentifiers: ['risk:view'],
      });

    expect(response.status).toBe(201);
    expect(response.headers.location).toContain('/admin/roles/');
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({
      name,
      description: 'Papel de teste.',
      isSystem: false,
      assignedUserCount: 0,
    });
    expect(body.permissions).toEqual([expect.objectContaining({ identifier: 'risk:view' })]);
  });

  it('refuses creating a role with a name already in use (409)', async () => {
    const name = `Fixture Duplicate ${uniqueTestMarker('name')}`;
    const first = await agent
      .post('/api/v1/admin/roles')
      .set('Origin', appOrigin)
      .send({ name, description: 'Primeiro.', permissionIdentifiers: [] });
    expect(first.status).toBe(201);

    const second = await agent
      .post('/api/v1/admin/roles')
      .set('Origin', appOrigin)
      .send({ name, description: 'Segundo.', permissionIdentifiers: [] });
    expect(second.status).toBe(409);
  });

  it('refuses creating a role with an unknown permission identifier (422)', async () => {
    const response = await agent
      .post('/api/v1/admin/roles')
      .set('Origin', appOrigin)
      .send({
        name: `Fixture Invalid Perm ${uniqueTestMarker('name')}`,
        description: 'x',
        permissionIdentifiers: ['not:a-real-permission'],
      });
    expect(response.status).toBe(422);
  });

  it('lists roles in the {data, meta} pagination envelope', async () => {
    const response = await agent.get('/api/v1/admin/roles').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as { data: unknown[]; meta: Record<string, unknown> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toMatchObject({ page: 1, pageSize: 25 });
  });

  it('retrieves a role by id, 404 for a nonexistent one', async () => {
    const created = await agent
      .post('/api/v1/admin/roles')
      .set('Origin', appOrigin)
      .send({
        name: `Fixture Detail ${uniqueTestMarker('name')}`,
        description: 'x',
        permissionIdentifiers: [],
      });
    const roleId = (created.body as { id: string }).id;

    const found = await agent.get(`/api/v1/admin/roles/${roleId}`).set('Origin', appOrigin);
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ id: roleId });

    const notFound = await agent
      .get(`/api/v1/admin/roles/${randomUUID()}`)
      .set('Origin', appOrigin);
    expect(notFound.status).toBe(404);
  });

  it('updates name/description/permissions via PATCH, refusing an empty body with 400', async () => {
    const created = await agent
      .post('/api/v1/admin/roles')
      .set('Origin', appOrigin)
      .send({
        name: `Fixture Update ${uniqueTestMarker('name')}`,
        description: 'Antes.',
        permissionIdentifiers: ['risk:view'],
      });
    const roleId = (created.body as { id: string }).id;

    const empty = await agent
      .patch(`/api/v1/admin/roles/${roleId}`)
      .set('Origin', appOrigin)
      .send({});
    expect(empty.status).toBe(400);

    const updated = await agent
      .patch(`/api/v1/admin/roles/${roleId}`)
      .set('Origin', appOrigin)
      .send({ description: 'Depois.', permissionIdentifiers: ['risk:create'] });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ description: 'Depois.' });
    const permissions = (updated.body as { permissions: readonly { identifier: string }[] })
      .permissions;
    expect(permissions.map((p) => p.identifier)).toEqual(['risk:create']);
  });

  it('refuses renaming a role to a name already in use (409)', async () => {
    const nameA = `Fixture Rename A ${uniqueTestMarker('name')}`;
    const nameB = `Fixture Rename B ${uniqueTestMarker('name')}`;
    await agent
      .post('/api/v1/admin/roles')
      .set('Origin', appOrigin)
      .send({ name: nameA, description: 'x', permissionIdentifiers: [] });
    const roleB = await agent
      .post('/api/v1/admin/roles')
      .set('Origin', appOrigin)
      .send({ name: nameB, description: 'x', permissionIdentifiers: [] });
    const roleBId = (roleB.body as { id: string }).id;

    const response = await agent
      .patch(`/api/v1/admin/roles/${roleBId}`)
      .set('Origin', appOrigin)
      .send({ name: nameA });
    expect(response.status).toBe(409);
  });

  it('deletes an unassigned, non-system role (204); refuses deleting one still assigned to a user (422)', async () => {
    const prisma = ctx.app.get(PrismaService);

    const deletable = await agent
      .post('/api/v1/admin/roles')
      .set('Origin', appOrigin)
      .send({
        name: `Fixture Deletable ${uniqueTestMarker('name')}`,
        description: 'x',
        permissionIdentifiers: [],
      });
    const deletableId = (deletable.body as { id: string }).id;
    const deleteResponse = await agent
      .delete(`/api/v1/admin/roles/${deletableId}`)
      .set('Origin', appOrigin);
    expect(deleteResponse.status).toBe(204);

    const assigned = await agent
      .post('/api/v1/admin/roles')
      .set('Origin', appOrigin)
      .send({
        name: `Fixture Assigned ${uniqueTestMarker('name')}`,
        description: 'x',
        permissionIdentifiers: [],
      });
    const assignedId = (assigned.body as { id: string }).id;
    const assignedUser = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('ar-assigned')}@example.test`,
    });
    await prisma.client.userRole.create({
      data: {
        userId: assignedUser.user.id,
        roleId: assignedId,
        grantedByUserId: assignedUser.user.id,
        grantedAt: new Date(),
      },
    });

    const refused = await agent
      .delete(`/api/v1/admin/roles/${assignedId}`)
      .set('Origin', appOrigin);
    expect(refused.status).toBe(422);
  });

  it('refuses every write to a system role — name, description and permission set alike (422) — and refuses deleting it', async () => {
    const prisma = ctx.app.get(PrismaService);
    const systemRole = await prisma.client.role.create({
      data: {
        name: `Fixture System Role ${uniqueTestMarker('name')}`,
        description: 'Original.',
        isSystem: true,
      },
    });

    const renameAttempt = await agent
      .patch(`/api/v1/admin/roles/${systemRole.id}`)
      .set('Origin', appOrigin)
      .send({ name: 'Novo nome' });
    expect(renameAttempt.status).toBe(422);

    const permissionAttempt = await agent
      .patch(`/api/v1/admin/roles/${systemRole.id}`)
      .set('Origin', appOrigin)
      .send({ permissionIdentifiers: ['risk:view'] });
    expect(permissionAttempt.status).toBe(422);

    const descriptionAttempt = await agent
      .patch(`/api/v1/admin/roles/${systemRole.id}`)
      .set('Origin', appOrigin)
      .send({ description: 'Descrição atualizada.' });
    expect(descriptionAttempt.status).toBe(422);

    const stored = await prisma.client.role.findUniqueOrThrow({ where: { id: systemRole.id } });
    expect(stored.name).toBe(systemRole.name);
    expect(stored.description).toBe('Original.');

    const deleteAttempt = await agent
      .delete(`/api/v1/admin/roles/${systemRole.id}`)
      .set('Origin', appOrigin);
    expect(deleteAttempt.status).toBe(422);
  });
});
