import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';
import { buildContractTestApp, type ContractTestContext } from '../contract/support/contract-app';

import {
  assignRoleFixture,
  createPermissionFixture,
  createRoleWithPermissionsFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createLocalUserFixture } from './support/fixtures';

const API_PREFIX = '/api/v1';
const PROBLEM_TYPE_BASE = 'https://pharosgrc.dev/problems';
const VALIDATION_TYPE = `${PROBLEM_TYPE_BASE}/validation`;
const CONFLICT_TYPE = `${PROBLEM_TYPE_BASE}/conflict`;

interface ProblemBody {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly correlationId?: string;
}

describe('A system role is immutable, and the refusal names its own cause (F-68, STATE §16.1 item 3)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    prisma = ctx.app.get(PrismaService);

    await createPermissionFixture(prisma, 'risk:view');
    await createPermissionFixture(prisma, 'risk:create');

    const adminRole = await createRoleWithPermissionsFixture(prisma, ['role:administer'], {
      name: `fixture-sysrole-immutability-${randomUUID()}`,
    });
    const admin = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('sysrole-admin')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: admin.user, role: adminRole });

    agent = request.agent(ctx.app.getHttpServer());
    const login = await agent
      .post(`${API_PREFIX}/auth/login`)
      .set('Origin', appOrigin)
      .send({ email: admin.user.email, password: admin.rawPassword });
    expect(login.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function createSystemRole(description = 'Descrição semeada original.'): Promise<{
    id: string;
    name: string;
    description: string;
  }> {
    const role = await prisma.client.role.create({
      data: {
        name: `Fixture System ${uniqueTestMarker('sysrole')}`,
        description,
        isSystem: true,
      },
    });
    return { id: role.id, name: role.name, description: role.description };
  }

  async function createCustomRole(): Promise<{ id: string; name: string }> {
    const response = await agent
      .post(`${API_PREFIX}/admin/roles`)
      .set('Origin', appOrigin)
      .send({
        name: `Fixture Custom ${uniqueTestMarker('customrole')}`,
        description: 'Papel personalizado de teste.',
        permissionIdentifiers: ['risk:view'],
      });
    expect(response.status).toBe(201);
    const body = response.body as { id: string; name: string };
    return { id: body.id, name: body.name };
  }

  function expectProblemEnvelope(body: ProblemBody, status: number, instancePath: string): void {
    expect(body.status).toBe(status);
    expect(typeof body.detail).toBe('string');
    expect(body.instance).toContain(instancePath);
    expect(typeof body.correlationId).toBe('string');
  }

  const systemRoleRefusals: readonly { readonly label: string; readonly body: object }[] = [
    { label: 'name', body: { name: 'Nome novo' } },
    { label: 'description', body: { description: 'Descrição escrita pelo operador.' } },
    { label: 'permissionIdentifiers', body: { permissionIdentifiers: ['risk:view'] } },
    {
      label: 'all three at once',
      body: {
        name: 'Nome novo',
        description: 'Descrição escrita pelo operador.',
        permissionIdentifiers: ['risk:view'],
      },
    },
  ];

  for (const refusal of systemRoleRefusals) {
    it(`refuses writing ${refusal.label} on a system role, with the system-role cause in the problem body`, async () => {
      const role = await createSystemRole();

      const response = await agent
        .patch(`${API_PREFIX}/admin/roles/${role.id}`)
        .set('Origin', appOrigin)
        .send(refusal.body);

      expect(response.status).toBe(422);
      const problem = response.body as ProblemBody;
      expectProblemEnvelope(problem, 422, `/admin/roles/${role.id}`);
      expect(problem.type).toBe(VALIDATION_TYPE);
      expect(problem.title).toBe(USER_MESSAGES.problemTitle.unprocessableEntity);

      expect(problem.detail).toBe(USER_MESSAGES.admin.systemRoleImmutable);
      expect(problem.detail).not.toBe(USER_MESSAGES.admin.invalidPermissionIdentifiers);
      expect(problem.detail).not.toBe(USER_MESSAGES.admin.roleNameAlreadyInUse);
      expect(problem.detail).not.toBe(USER_MESSAGES.admin.systemRoleNotDeletable);
      expect(problem.detail).not.toBe(USER_MESSAGES.admin.updateRequestEmpty);

      const stored = await prisma.client.role.findUniqueOrThrow({ where: { id: role.id } });
      expect(stored.name).toBe(role.name);
      expect(stored.description).toBe(role.description);
      expect(stored.isSystem).toBe(true);
    });
  }

  it('refuses a description identical to the stored one — there is no no-op exemption (F-68)', async () => {
    const role = await createSystemRole('Descrição idêntica.');

    const response = await agent
      .patch(`${API_PREFIX}/admin/roles/${role.id}`)
      .set('Origin', appOrigin)
      .send({ description: 'Descrição idêntica.' });

    expect(response.status).toBe(422);
    expect((response.body as ProblemBody).detail).toBe(USER_MESSAGES.admin.systemRoleImmutable);
  });

  it('writes NO audit event for a refused edit — the trail never claims an edit the database did not keep (F-68, CLAUDE.md §8)', async () => {
    const role = await createSystemRole();

    for (const refusal of systemRoleRefusals) {
      const response = await agent
        .patch(`${API_PREFIX}/admin/roles/${role.id}`)
        .set('Origin', appOrigin)
        .send(refusal.body);
      expect(response.status).toBe(422);
    }

    const events = await prisma.client.auditEvent.findMany({
      where: { entityId: role.id },
      select: { action: true },
    });
    expect(events).toEqual([]);
  });

  it('refuses DELETE on a system role with a DIFFERENT cause in the body — the two 422s are not interchangeable', async () => {
    const role = await createSystemRole();

    const response = await agent
      .delete(`${API_PREFIX}/admin/roles/${role.id}`)
      .set('Origin', appOrigin);

    expect(response.status).toBe(422);
    const problem = response.body as ProblemBody;
    expect(problem.type).toBe(VALIDATION_TYPE);
    expect(problem.detail).toBe(USER_MESSAGES.admin.systemRoleNotDeletable);
    expect(problem.detail).not.toBe(USER_MESSAGES.admin.systemRoleImmutable);
  });

  it('accepts name, description and permissions on a CUSTOM role, singly and together (200)', async () => {
    const role = await createCustomRole();

    const renamed = await agent
      .patch(`${API_PREFIX}/admin/roles/${role.id}`)
      .set('Origin', appOrigin)
      .send({ name: `${role.name} renomeado` });
    expect(renamed.status).toBe(200);

    const described = await agent
      .patch(`${API_PREFIX}/admin/roles/${role.id}`)
      .set('Origin', appOrigin)
      .send({ description: 'Descrição ajustada.' });
    expect(described.status).toBe(200);

    const repermissioned = await agent
      .patch(`${API_PREFIX}/admin/roles/${role.id}`)
      .set('Origin', appOrigin)
      .send({ permissionIdentifiers: ['risk:view', 'risk:create'] });
    expect(repermissioned.status).toBe(200);

    const allThree = await agent
      .patch(`${API_PREFIX}/admin/roles/${role.id}`)
      .set('Origin', appOrigin)
      .send({
        name: `${role.name} final`,
        description: 'Descrição final.',
        permissionIdentifiers: ['risk:view'],
      });
    expect(allThree.status).toBe(200);
    expect(allThree.body).toMatchObject({
      name: `${role.name} final`,
      description: 'Descrição final.',
      isSystem: false,
    });
  });

  it('distinguishes an unknown permission identifier: same status, same type, DIFFERENT detail', async () => {
    const role = await createCustomRole();

    const response = await agent
      .patch(`${API_PREFIX}/admin/roles/${role.id}`)
      .set('Origin', appOrigin)
      .send({ permissionIdentifiers: ['risk:does-not-exist'] });

    expect(response.status).toBe(422);
    const problem = response.body as ProblemBody;
    expect(problem.type).toBe(VALIDATION_TYPE);
    expect(problem.detail).toBe(USER_MESSAGES.admin.invalidPermissionIdentifiers);
    expect(problem.detail).not.toBe(USER_MESSAGES.admin.systemRoleImmutable);
  });

  it('distinguishes a duplicate name: a 409 with the conflict type, never the system-role refusal', async () => {
    const first = await createCustomRole();
    const second = await createCustomRole();

    const response = await agent
      .patch(`${API_PREFIX}/admin/roles/${second.id}`)
      .set('Origin', appOrigin)
      .send({ name: first.name });

    expect(response.status).toBe(409);
    const problem = response.body as ProblemBody;
    expectProblemEnvelope(problem, 409, `/admin/roles/${second.id}`);
    expect(problem.type).toBe(CONFLICT_TYPE);
    expect(problem.type).not.toBe(VALIDATION_TYPE);
    expect(problem.detail).toBe(USER_MESSAGES.admin.roleNameAlreadyInUse);
  });

  it('distinguishes an empty update body: a 400, with neither 422 detail', async () => {
    const role = await createSystemRole();

    const response = await agent
      .patch(`${API_PREFIX}/admin/roles/${role.id}`)
      .set('Origin', appOrigin)
      .send({});

    expect(response.status).toBe(400);
    const problem = response.body as ProblemBody;
    expect(problem.detail).not.toBe(USER_MESSAGES.admin.systemRoleImmutable);
    expect(problem.detail).toBe(USER_MESSAGES.admin.updateRequestEmpty);
  });
});
