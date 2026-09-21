/**
 * 2026-09-14 — a system role is owned by the platform WHOLE, and the refusal
 * says so in a way a caller can tell apart from every other 422.
 *
 * ## The two gaps this closes
 *
 * **F-68** (`docs/deferred-findings.md`): `RoleAdminService.update` refused
 * `name` and `permissionIdentifiers` on a system role and ACCEPTED
 * `description`. The seed's `upsertSystemRoles` reconciles `description` on
 * every run, so the field had two writers: an administrator could edit it
 * through the product, the edit was recorded as a `role.updated`
 * `audit_event`, and the next seed run silently restored the file's literal
 * writing no audit event at all (a seed run has no acting identity, ADR-005).
 * The trail then asserted a state the database no longer had. The product
 * decision — taken 2026-09-14 — is that the seed file is the single declared
 * owner of all three fields, the seed KEEPS reconciling, and the service
 * refuses every write that would compete with it.
 *
 * **STATE §16.1 item 3**: the one test that guarded the old rule
 * (`test/contract/admin-roles.spec.ts`) asserted status codes only. A 422
 * "because it is a system role" and a 422 "because a permission identifier
 * does not exist" were indistinguishable to it, so the rule could have been
 * replaced by any other refusal and the test would not have noticed. Every
 * assertion below reads the RFC 9457 body — `type`, `title`, `detail` — and
 * the counter-controls at the end prove those bodies really do differ.
 *
 * ## Why the audit assertion is here and not incidental
 *
 * F-68 is a defect ABOUT the audit trail, so "the request is refused" is only
 * half the fix. The other half is that a refused edit leaves no `role.updated`
 * row claiming it happened. That is asserted directly against `audit_event`.
 *
 * ## Test marker prefixes
 *
 * F-45/F-54: `uniqueTestMarker` appends a 36-character UUID, and a prefix of
 * exactly 2 or 6 characters yields a 43-character base64url-looking marker
 * that `information-disclosure.spec.ts` reports as a leaked session token.
 * Every prefix here is longer.
 */
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

  /** A real `isSystem: true` row, created directly — the API never creates one (`prisma-role.repository.ts` forces `isSystem: false`). */
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

  /** Asserts the shape every problem of this API carries (ADR-009, RFC 9457). */
  function expectProblemEnvelope(body: ProblemBody, status: number, instancePath: string): void {
    expect(body.status).toBe(status);
    expect(typeof body.detail).toBe('string');
    expect(body.instance).toContain(instancePath);
    expect(typeof body.correlationId).toBe('string');
  }

  // -------------------------------------------------------------------
  // The rule, field by field and all together — by BODY, not by status.
  // -------------------------------------------------------------------

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

      // THE assertion §16.1 item 3 asked for: the cause, not merely the code.
      expect(problem.detail).toBe(USER_MESSAGES.admin.systemRoleImmutable);
      // And it is not any of the other refusals this endpoint can produce.
      expect(problem.detail).not.toBe(USER_MESSAGES.admin.invalidPermissionIdentifiers);
      expect(problem.detail).not.toBe(USER_MESSAGES.admin.roleNameAlreadyInUse);
      expect(problem.detail).not.toBe(USER_MESSAGES.admin.systemRoleNotDeletable);
      expect(problem.detail).not.toBe(USER_MESSAGES.admin.updateRequestEmpty);

      // Nothing was written.
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

    /*
     * A "nothing actually changed, so let it pass" exemption would be the
     * defect coming back through a side door: the client that sent it would
     * be told the write succeeded, and the field would still have two
     * owners. The rule is about WHO MAY WRITE, not about whether the value
     * differs.
     */
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

    /*
     * The heart of F-68. The old behaviour recorded `role.updated` for a
     * description edit that the next seed run silently undid, so the trail
     * asserted a state the database no longer had. A refused write must
     * leave the trail saying nothing happened, because nothing did.
     */
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

  // -------------------------------------------------------------------
  // The counter-control: a CUSTOM role accepts all three.
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // The other refusals, so "422" is never read as "system role".
  // -------------------------------------------------------------------

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
    // Same status AND same type as the system-role refusal — which is exactly
    // why the old status-only assertion could not tell them apart.
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

    /*
     * Deliberately asserted on a SYSTEM role: the emptiness check runs in the
     * controller, before the service's system-role rule, so this proves the
     * two refusals stay distinct even where both could plausibly apply.
     */
    expect(response.status).toBe(400);
    const problem = response.body as ProblemBody;
    expect(problem.detail).not.toBe(USER_MESSAGES.admin.systemRoleImmutable);
    expect(problem.detail).toBe(USER_MESSAGES.admin.updateRequestEmpty);
  });
});
