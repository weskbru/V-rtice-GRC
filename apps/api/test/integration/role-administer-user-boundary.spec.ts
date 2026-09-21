/**
 * 2026-09-14 — `role:administer` does NOT imply `user:administer`, proved on
 * the SERVER, against real tables and the real guard chain.
 *
 * ## Why this file exists
 *
 * `specs/015-roles-permissions-surface/STATE.md` §16.1 item 1 says it
 * plainly: before this file, the non-implication was TRUE by implementation
 * and guarded by nothing on the server. Every existing guard lived on the
 * web side — `role-users-tab.test.tsx`, `role-admin-view.test.tsx` and one
 * Playwright scenario — and all three assert the rendered DOM of a client
 * that DECIDES not to call `/admin/users`. The nearest API test,
 * `test/contract/admin-permissions.spec.ts:182`, denies a caller holding
 * `risk:view`, which says nothing about a role administrator.
 *
 * So a "`role:administer` is super-administrator" shortcut in
 * `PermissionGuard` would have kept every one of those green. This file is
 * the one that goes red: it logs in an identity holding `role:administer`
 * and NOTHING else, and asserts both halves of the boundary at once.
 *
 * ## The sweep is exhaustive by construction, not by hand
 *
 * The denied half is not a hand-written list of routes that someone must
 * remember to extend. It is read from `apps/api/openapi.json` — the
 * committed, route-level reflection of what NestJS actually registered
 * (D-14, kept fresh by the `openapi:check` gate, and the same source
 * `information-disclosure.spec.ts` sweeps). Every operation whose path
 * begins with `/api/v1/admin/users` is exercised, so a bypass introduced on
 * ANY of them fails here, including one added after this file was written.
 *
 * ## The one operation that is reachable, and why it is not a bypass
 *
 * `PUT /admin/users/{userId}/roles` is gated by `role:administer` ON
 * PURPOSE — `admin.openapi.yaml` declares it under the `Roles` permission,
 * and `AdminUsersController`'s own header calls the narrowing deliberate:
 * assigning a role IS role administration, performed on a user. It is
 * therefore expected to answer 2xx here, and the assertion below pins it as
 * the SOLE exception: a second role-gated user operation, or the loss of
 * this one, both fail this test rather than passing unnoticed.
 *
 * ## Its response shape is now asserted too (F-73)
 *
 * When this file was written, that operation answered a full
 * `UserDetailResponse` — name, e-mail, job title, status, organizational
 * unit, roles and scope grants — which meant the ONE route a caller without
 * `user:administer` can reach handed over precisely the data FR-018/FR-020
 * exist to withhold. The header of this file recorded that as a fact it was
 * not this file's to change; F-73 changed it, deliberately, as a contract
 * decision (`admin.openapi.yaml`'s new `UserRoleAssignment` schema).
 *
 * The authorization did NOT move: this operation still requires
 * `role:administer`, and `GET /admin/users/{userId}` still requires
 * `user:administer` — both asserted below. What the test now also pins is
 * the RESPONSE: its EXACT key set, not a blacklist of forbidden names. A
 * key set is the stronger form, because it fails for a field nobody thought
 * to forbid — the way `UserDetailResponse` creeping back, in whole or in
 * part, would.
 *
 * One fact remains recorded rather than asserted: `GET /users` (the reduced
 * directory, `@NoPermissionRequired`) is available to EVERY authenticated
 * session by contract, so it is outside this boundary entirely and is not
 * swept.
 *
 * ## Test marker prefixes
 *
 * F-45/F-54: `uniqueTestMarker` appends a 36-character UUID, and a prefix of
 * exactly 2 or 6 characters yields a 43-character base64url-looking string
 * that `information-disclosure.spec.ts` reports as a leaked session token.
 * The prefixes here are 14 and 19 characters.
 */
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

/** The single `/admin/users**` operation the contract gates by `role:administer`. */
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

/** Every registered operation under `/api/v1/admin/users`, read from the
 * reflected document rather than transcribed from the controllers. */
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

/** Substitutes a fresh UUID for every `{param}` — the permission guard runs
 * BEFORE `ParseUUIDPipe` and the validation pipe, so a syntactically valid
 * but nonexistent id is enough to reach the decision under test. */
function concretePath(templatePath: string): string {
  return templatePath.replace(/\{[^}]+\}/g, () => randomUUID());
}

describe('role:administer does NOT imply user:administer (015 FR-019, STATE §16.1 item 1)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let prisma: PrismaService;
  /** Holds `role:administer` and nothing else. */
  let roleAdminAgent: ReturnType<typeof request.agent>;
  /** A real target for the one reachable operation (F-73). */
  let targetUserId: string;
  let targetUserEmail: string;
  let assignableRoleId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    prisma = ctx.app.get(PrismaService);

    // `risk:view` exists only so the role-administration happy path below has
    // a real permission identifier to put into a role it creates.
    await createPermissionFixture(prisma, 'risk:view');

    const role = await createRoleWithPermissionsFixture(prisma, ['role:administer'], {
      name: `fixture-roleadmin-boundary-${randomUUID()}`,
    });
    const roleAdmin = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('roleadmin-only')}@example.test`,
    });
    await assignRoleFixture(prisma, { user: roleAdmin.user, role });

    // The subject of the one reachable operation, carrying REAL personal
    // data — a distinctive name, e-mail and job title. If the minimized
    // response of F-73 is ever widened back out, the assertions below fail
    // on this content, not on an empty shape that would leak nothing anyway.
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

  // -------------------------------------------------------------------
  // The premise: the identity really does hold exactly one permission.
  // Without this, a 403 sweep below could pass for the wrong reason.
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Positive half — role administration works in full.
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Negative half — the WHOLE user-administration surface, swept.
  // -------------------------------------------------------------------

  it('sweeps a non-empty set of registered /admin/users operations (sanity check on the sweep itself)', () => {
    const operations = readAdminUserOperations();
    // A sweep that found nothing would pass the test below vacuously. The
    // floor is deliberately loose — this asserts the reader works, not how
    // many routes the platform happens to have today.
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

      // 403, never 400/404/422: the guard decides before the validation pipe,
      // the handler and the repository, so "you may not" must be the answer
      // even for an empty body and an id that does not exist. Any other
      // status means the request got PAST the permission check.
      if (response.status === 403) {
        denied.push(operation.label);
      } else {
        reachable.push(`${operation.label} -> ${String(response.status)}`);
      }
    }

    // Named, not counted: a failure says WHICH operation opened up, and with
    // what status. The `-> 400` is the validation pipe refusing the empty
    // body this sweep sends — i.e. proof the request got past the guard,
    // which for this one operation is what the contract says should happen.
    expect(reachable).toEqual([`${ROLE_GATED_USER_OPERATION} -> 400`]);
    expect(denied).toHaveLength(operations.length - 1);
  });

  it('lets the one role-gated user operation through to its own handler (404 on an unknown user), not to a permission refusal', async () => {
    const response = await roleAdminAgent
      .put(`${ADMIN_USERS_PREFIX}/${randomUUID()}/roles`)
      .set('Origin', appOrigin)
      .send({ roleIds: [] });

    // 404 — `GetUserUseCase` refusing an id that does not exist. Reaching
    // that code at all proves `role:administer` carried the request through
    // `PermissionGuard`, deliberately, per `admin.openapi.yaml`.
    expect(response.status).toBe(404);
  });

  // -------------------------------------------------------------------
  // F-73 — the reachable operation still WORKS, and its response is
  // minimized. Both halves, on the same request.
  // -------------------------------------------------------------------

  it('assigns a role to a real user with role:administer alone, and answers ONLY {userId, roles} (F-73)', async () => {
    const response = await roleAdminAgent
      .put(`${ADMIN_USERS_PREFIX}/${targetUserId}/roles`)
      .set('Origin', appOrigin)
      .send({ roleIds: [assignableRoleId] });

    // Half one — the capability is intact. `role:administer` administers
    // role assignment, and F-73 did not narrow that by one step.
    expect(response.status).toBe(200);
    const body = response.body as {
      readonly userId: string;
      readonly roles: readonly Record<string, unknown>[];
    };
    expect(body.userId).toBe(targetUserId);
    expect(body.roles.map((role) => role.id)).toEqual([assignableRoleId]);

    // Half two — EXACT key set, not a blacklist. A blacklist of
    // `email`/`jobTitle`/`primaryOrgUnit`/`scopeGrants` would pass happily
    // for a field added later; this fails for ANY key that is not one of
    // the two the contract's `UserRoleAssignment` declares, including every
    // field of `UserDetail` and anything invented after today.
    expect(Object.keys(body).sort()).toEqual(['roles', 'userId']);
    for (const role of body.roles) {
      expect(Object.keys(role).sort()).toEqual(['id', 'name']);
    }

    // The same statement in the form a human reads at a glance: the target's
    // own personal data, which the server had in hand while answering, is
    // nowhere in the bytes it sent.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(targetUserEmail);
    expect(serialized).not.toContain('Alvo Confidencial da Fronteira');
    expect(serialized).not.toContain('Cargo Confidencial da Fronteira');
  });

  it('still requires user:administer for the operations that DO return the administrative user record (F-73)', async () => {
    // F-73 minimized one representation. It must not have moved the
    // boundary itself: the routes that legitimately answer `UserDetail`
    // remain closed to this identity, for the same target user it just
    // successfully assigned a role to.
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

    // The refusals disclose nothing beyond "forbidden" — no e-mail, no name,
    // no count, no statement about whether that user exists (FR-030).
    for (const response of [list, byRole, detail]) {
      const body = JSON.stringify(response.body);
      expect(body).not.toMatch(/@example\.test/);
      expect(body).not.toMatch(/user:administer/);
    }
  });
});
