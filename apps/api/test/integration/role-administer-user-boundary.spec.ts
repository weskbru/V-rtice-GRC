import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { buildContractTestApp, type ContractTestContext } from '../contract/support/contract-app';

import {
  assignRoleFixture,
  createPermissionFixture,
  createRoleWithPermissionsFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createLocalUserFixture } from './support/fixtures';

const API_PREFIX = '/api/v1';
const ADMIN_USERS_PREFIX = `${API_PREFIX}/admin/users`;

const ROLE_GATED_USER_OPERATION = `PUT ${ADMIN_USERS_PREFIX}/{userId}/roles`;

interface OpenApiDocument {
  readonly paths: Record<string, Record<string, unknown>>;
}

type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

const HTTP_METHODS: readonly HttpMethod[] = ['get', 'post', 'patch', 'put', 'delete'];

interface RegisteredOperation {
  readonly method: HttpMethod;
  readonly templatePath: string;
  readonly label: string;
}

function readAdminUserOperations(): readonly RegisteredOperation[] {
  const documentPath = path.resolve(__dirname, '../../openapi.json');
  const document = JSON.parse(readFileSync(documentPath, 'utf8')) as OpenApiDocument;

  const operations: RegisteredOperation[] = [];
  for (const [templatePath, methods] of Object.entries(document.paths)) {
    if (!templatePath.startsWith(ADMIN_USERS_PREFIX)) continue;
    for (const method of HTTP_METHODS) {
      if (!(method in methods)) continue;
      operations.push({
        method,
        templatePath,
        label: `${method.toUpperCase()} ${templatePath}`,
      });
    }
  }
  return operations;
}

function concretePath(templatePath: string): string {
  return templatePath.replace(/\{[^}]+\}/g, () => randomUUID());
}

describe('role:administer does NOT imply user:administer (015 FR-019, STATE §16.1 item 1)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let prisma: PrismaService;
  let roleAdminAgent: ReturnType<typeof request.agent>;
  let targetUserId: string;
  let targetUserEmail: string;
  let assignableRoleId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    prisma = ctx.app.get(PrismaService);

    await createPermissionFixture(prisma, 'risk:view');

    const role = await createRoleWithPermissionsFixture(prisma, ['role:administer'], {
      name: `fixture-roleadmin-boundary-${randomUUID()}`,
    });
    const roleAdmin = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('roleadmin-only')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: roleAdmin.user, role });

    const target = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('roleadmin-target')}@example.test`,
      fullName: 'Alvo Confidencial da Fronteira',
      jobTitle: 'Cargo Confidencial da Fronteira',
    });
    targetUserId = target.user.id;
    targetUserEmail = target.user.email;

    const assignable = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-roleadmin-assignable-${randomUUID()}`,
    });
    assignableRoleId = assignable.id;

    roleAdminAgent = request.agent(ctx.app.getHttpServer());
    const login = await roleAdminAgent
      .post(`${API_PREFIX}/auth/login`)
      .set('Origin', appOrigin)
      .send({ email: roleAdmin.user.email, password: roleAdmin.rawPassword });
    expect(login.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('holds role:administer and does NOT hold user:administer', async () => {
    const permissions = await roleAdminAgent
      .get(`${API_PREFIX}/auth/session`)
      .set('Origin', appOrigin);
    expect(permissions.status).toBe(200);

    const body = permissions.body as { permissions?: readonly string[] };
    expect(body.permissions).toContain('role:administer');
    expect(body.permissions).not.toContain('user:administer');
    expect(body.permissions).not.toContain('org_unit:administer');
  });

  it('reaches every role-administration route (2xx) with role:administer alone', async () => {
    const list = await roleAdminAgent.get(`${API_PREFIX}/admin/roles`).set('Origin', appOrigin);
    expect(list.status).toBe(200);

    const summary = await roleAdminAgent
      .get(`${API_PREFIX}/admin/roles/summary`)
      .set('Origin', appOrigin);
    expect(summary.status).toBe(200);

    const permissions = await roleAdminAgent
      .get(`${API_PREFIX}/admin/permissions`)
      .set('Origin', appOrigin);
    expect(permissions.status).toBe(200);

    const created = await roleAdminAgent
      .post(`${API_PREFIX}/admin/roles`)
      .set('Origin', appOrigin)
      .send({
        name: `Fixture Boundary ${uniqueTestMarker('roleadmin-boundary')}`,
        description: 'Papel criado pelo teste de fronteira.',
        permissionIdentifiers: ['risk:view'],
      });
    expect(created.status).toBe(201);
    const createdId = (created.body as { id: string }).id;

    const read = await roleAdminAgent
      .get(`${API_PREFIX}/admin/roles/${createdId}`)
      .set('Origin', appOrigin);
    expect(read.status).toBe(200);

    const patched = await roleAdminAgent
      .patch(`${API_PREFIX}/admin/roles/${createdId}`)
      .set('Origin', appOrigin)
      .send({ description: 'Descrição ajustada pelo teste de fronteira.' });
    expect(patched.status).toBe(200);

    const removed = await roleAdminAgent
      .delete(`${API_PREFIX}/admin/roles/${createdId}`)
      .set('Origin', appOrigin);
    expect(removed.status).toBe(204);
  });

  it('sweeps a non-empty set of registered /admin/users operations (sanity check on the sweep itself)', () => {
    const operations = readAdminUserOperations();
    expect(operations.length).toBeGreaterThanOrEqual(8);
    expect(operations.map((operation) => operation.label)).toContain(ROLE_GATED_USER_OPERATION);
  });

  it('is refused (403) by EVERY /admin/users operation except the one the contract gates by role:administer', async () => {
    const operations = readAdminUserOperations();
    const denied: string[] = [];
    const reachable: string[] = [];

    for (const operation of operations) {
      const response = await roleAdminAgent[operation.method](concretePath(operation.templatePath))
        .set('Origin', appOrigin)
        .send({});

      if (response.status === 403) {
        denied.push(operation.label);
      } else {
        reachable.push(`${operation.label} -> ${String(response.status)}`);
      }
    }

    expect(reachable).toEqual([`${ROLE_GATED_USER_OPERATION} -> 400`]);
    expect(denied).toHaveLength(operations.length - 1);
  });

  it('lets the one role-gated user operation through to its own handler (404 on an unknown user), not to a permission refusal', async () => {
    const response = await roleAdminAgent
      .put(`${ADMIN_USERS_PREFIX}/${randomUUID()}/roles`)
      .set('Origin', appOrigin)
      .send({ roleIds: [] });

    expect(response.status).toBe(404);
  });

  it('assigns a role to a real user with role:administer alone, and answers ONLY {userId, roles} (F-73)', async () => {
    const response = await roleAdminAgent
      .put(`${ADMIN_USERS_PREFIX}/${targetUserId}/roles`)
      .set('Origin', appOrigin)
      .send({ roleIds: [assignableRoleId] });

    expect(response.status).toBe(200);
    const body = response.body as {
      readonly userId: string;
      readonly roles: readonly Record<string, unknown>[];
    };
    expect(body.userId).toBe(targetUserId);
    expect(body.roles.map((role) => role.id)).toEqual([assignableRoleId]);

    expect(Object.keys(body).sort()).toEqual(['roles', 'userId']);
    for (const role of body.roles) {
      expect(Object.keys(role).sort()).toEqual(['id', 'name']);
    }

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(targetUserEmail);
    expect(serialized).not.toContain('Alvo Confidencial da Fronteira');
    expect(serialized).not.toContain('Cargo Confidencial da Fronteira');
  });

  it('still requires user:administer for the operations that DO return the administrative user record (F-73)', async () => {
    const detail = await roleAdminAgent
      .get(`${ADMIN_USERS_PREFIX}/${targetUserId}`)
      .set('Origin', appOrigin);
    expect(detail.status).toBe(403);

    const patched = await roleAdminAgent
      .patch(`${ADMIN_USERS_PREFIX}/${targetUserId}`)
      .set('Origin', appOrigin)
      .send({ jobTitle: 'Alteração que esta identidade não pode fazer.' });
    expect(patched.status).toBe(403);

    const status = await roleAdminAgent
      .put(`${ADMIN_USERS_PREFIX}/${targetUserId}/status`)
      .set('Origin', appOrigin)
      .send({ status: 'INACTIVE', reason: 'Tentativa que deve ser recusada.' });
    expect(status.status).toBe(403);

    for (const response of [detail, patched, status]) {
      expect(JSON.stringify(response.body)).not.toContain(targetUserEmail);
    }
  });

  it('refuses the three user reads the roles screen would need, by name (FR-018, FR-020)', async () => {
    const someUserId = randomUUID();

    const list = await roleAdminAgent.get(`${API_PREFIX}/admin/users`).set('Origin', appOrigin);
    expect(list.status).toBe(403);

    const byRole = await roleAdminAgent
      .get(`${API_PREFIX}/admin/users`)
      .query({ roleId: randomUUID() })
      .set('Origin', appOrigin);
    expect(byRole.status).toBe(403);

    const detail = await roleAdminAgent
      .get(`${API_PREFIX}/admin/users/${someUserId}`)
      .set('Origin', appOrigin);
    expect(detail.status).toBe(403);

    for (const response of [list, byRole, detail]) {
      const body = JSON.stringify(response.body);
      expect(body).not.toMatch(/@example\.test/);
      expect(body).not.toMatch(/user:administer/);
    }
  });
});
