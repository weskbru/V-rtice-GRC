/**
 * T180/D-11 — `/admin/users[/**]` (excluding `scope-grants`, covered by
 * `admin-scope-grants.spec.ts`): success-shape and business-rule coverage
 * for an administrator holding `user:administer`/`role:administer`.
 * Permission refusal (403) and unauthenticated refusal (401) are covered
 * exhaustively for every admin endpoint by `admin-permissions.spec.ts` and
 * `admin-unauthenticated.spec.ts` respectively — not repeated here.
 */
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
import { createLocalUserFixture, createOrgUnitFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

describe('Admin user administration (T180, US8)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const role = await createRoleWithPermissionsFixture(
      prisma,
      ['user:administer', 'role:administer'],
      { name: `fixture-admin-users-admin-role-${randomUUID()}` },
    );
    const admin = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('au-admin')}@example.test`,
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

  it('creates a user with the declared User shape, a Location header, and never a password hash', async () => {
    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('adm-org') });
    const email = `${uniqueTestMarker('au-created')}@example.test`;

    const response = await agent.post('/api/v1/admin/users').set('Origin', appOrigin).send({
      email,
      fullName: 'Usuário de Teste',
      jobTitle: 'Analista',
      primaryOrgUnitId: orgUnit.id,
      initialPassword: 'Fixture-Passw0rd!',
    });

    expect(response.status).toBe(201);
    expect(response.headers.location).toContain('/admin/users/');
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({
      email,
      fullName: 'Usuário de Teste',
      jobTitle: 'Analista',
      status: 'ACTIVE',
    });
    expect(body.primaryOrgUnit).toMatchObject({ id: orgUnit.id });
    expect(body.authenticationMethods).toEqual(['LOCAL']);
    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/passwordHash/i);
    expect(raw).not.toContain('Fixture-Passw0rd!');
  });

  it('refuses creating a user with an email already in use (409)', async () => {
    const email = `${uniqueTestMarker('adm-dup')}@example.test`;
    const first = await agent.post('/api/v1/admin/users').set('Origin', appOrigin).send({
      email,
      fullName: 'Primeiro',
      initialPassword: 'Fixture-Passw0rd!',
    });
    expect(first.status).toBe(201);

    const second = await agent.post('/api/v1/admin/users').set('Origin', appOrigin).send({
      email,
      fullName: 'Segundo',
      initialPassword: 'Fixture-Passw0rd!',
    });
    expect(second.status).toBe(409);
  });

  it('refuses an initial password that violates the password policy (422) — long enough to pass DTO shape, but only one character class', async () => {
    const response = await agent
      .post('/api/v1/admin/users')
      .set('Origin', appOrigin)
      .send({
        email: `${uniqueTestMarker('au-weak')}@example.test`,
        fullName: 'Fraco',
        initialPassword: 'alllowercaseonly',
      });
    expect(response.status).toBe(422);
  });

  it('lists users in the {data, meta} pagination envelope', async () => {
    const response = await agent.get('/api/v1/admin/users').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as { data: unknown[]; meta: Record<string, unknown> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toMatchObject({ page: 1, pageSize: 25 });
    expect(typeof body.meta.total).toBe('number');
    expect(typeof body.meta.totalPages).toBe('number');
  });

  it('retrieves a user by id as UserDetail (User + scopeGrants), 404 for a nonexistent one', async () => {
    const created = await agent
      .post('/api/v1/admin/users')
      .set('Origin', appOrigin)
      .send({
        email: `${uniqueTestMarker('au-detail')}@example.test`,
        fullName: 'Detalhe',
        initialPassword: 'Fixture-Passw0rd!',
      });
    expect(created.status).toBe(201);
    const userId = (created.body as { id: string }).id;

    const found = await agent.get(`/api/v1/admin/users/${userId}`).set('Origin', appOrigin);
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ id: userId });
    expect(Array.isArray((found.body as { scopeGrants: unknown[] }).scopeGrants)).toBe(true);

    const notFound = await agent
      .get(`/api/v1/admin/users/${randomUUID()}`)
      .set('Origin', appOrigin);
    expect(notFound.status).toBe(404);
  });

  it('updates profile fields via PATCH, refusing an empty body with 400', async () => {
    const created = await agent
      .post('/api/v1/admin/users')
      .set('Origin', appOrigin)
      .send({
        email: `${uniqueTestMarker('au-patch')}@example.test`,
        fullName: 'Antes',
        initialPassword: 'Fixture-Passw0rd!',
      });
    const userId = (created.body as { id: string }).id;

    const emptyBody = await agent
      .patch(`/api/v1/admin/users/${userId}`)
      .set('Origin', appOrigin)
      .send({});
    expect(emptyBody.status).toBe(400);

    const updated = await agent
      .patch(`/api/v1/admin/users/${userId}`)
      .set('Origin', appOrigin)
      .send({ fullName: 'Depois' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ fullName: 'Depois' });
  });

  it('resets a password (204), then refuses a weak replacement (422)', async () => {
    const created = await agent
      .post('/api/v1/admin/users')
      .set('Origin', appOrigin)
      .send({
        email: `${uniqueTestMarker('au-reset')}@example.test`,
        fullName: 'Reset',
        initialPassword: 'Fixture-Passw0rd!',
      });
    const userId = (created.body as { id: string }).id;

    const reset = await agent
      .put(`/api/v1/admin/users/${userId}/password`)
      .set('Origin', appOrigin)
      .send({ newPassword: 'Another-Fixture-Passw0rd!' });
    expect(reset.status).toBe(204);

    const weak = await agent
      .put(`/api/v1/admin/users/${userId}/password`)
      .set('Origin', appOrigin)
      .send({ newPassword: 'alllowercaseonly' });
    expect(weak.status).toBe(422);
  });

  it('revoking sessions is idempotent (204 even with zero active sessions)', async () => {
    const created = await agent
      .post('/api/v1/admin/users')
      .set('Origin', appOrigin)
      .send({
        email: `${uniqueTestMarker('au-sessions')}@example.test`,
        fullName: 'Sessões',
        initialPassword: 'Fixture-Passw0rd!',
      });
    const userId = (created.body as { id: string }).id;

    const first = await agent
      .delete(`/api/v1/admin/users/${userId}/sessions`)
      .set('Origin', appOrigin);
    expect(first.status).toBe(204);

    const second = await agent
      .delete(`/api/v1/admin/users/${userId}/sessions`)
      .set('Origin', appOrigin);
    expect(second.status).toBe(204);
  });

  it("replaces a user's roles via PUT, refusing an unknown role id with 422", async () => {
    const created = await agent
      .post('/api/v1/admin/users')
      .set('Origin', appOrigin)
      .send({
        email: `${uniqueTestMarker('au-roles')}@example.test`,
        fullName: 'Papéis',
        initialPassword: 'Fixture-Passw0rd!',
      });
    const userId = (created.body as { id: string }).id;

    const prisma = ctx.app.get(PrismaService);
    const role = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-au-target-role-${randomUUID()}`,
    });

    const invalid = await agent
      .put(`/api/v1/admin/users/${userId}/roles`)
      .set('Origin', appOrigin)
      .send({ roleIds: [randomUUID()] });
    expect(invalid.status).toBe(422);

    const valid = await agent
      .put(`/api/v1/admin/users/${userId}/roles`)
      .set('Origin', appOrigin)
      .send({ roleIds: [role.id] });
    expect(valid.status).toBe(200);
    const body = valid.body as {
      readonly userId: string;
      readonly roles: readonly Record<string, unknown>[];
    };
    expect(body.userId).toBe(userId);
    expect(body.roles.map((r) => r.id)).toContain(role.id);

    // F-73 — the contract answers `UserRoleAssignment`, not `UserDetail`.
    // Asserted as the EXACT key set rather than a list of forbidden names:
    // that is what also catches a field nobody thought to forbid. This
    // caller happens to hold `user:administer`, so the assertion is about
    // the REPRESENTATION, which is the same for everyone — the reason it
    // matters is the caller who holds only `role:administer`
    // (`test/integration/role-administer-user-boundary.spec.ts`).
    expect(Object.keys(body).sort()).toEqual(['roles', 'userId']);
    for (const assignedRole of body.roles) {
      expect(Object.keys(assignedRole).sort()).toEqual(['id', 'name']);
    }
  });
});
