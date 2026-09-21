/**
 * 2026-09-14 — ADR-021's second guard, built: the role privilege
 * classification changes no authorization decision. The BEHAVIOURAL half of
 * `specs/015-roles-permissions-surface/STATE.md` §16.1 item 2.
 *
 * ## What is actually asserted here
 *
 * The screen calls a role "privilegiado" when it grants at least one of
 * `role:administer`, `user:administer`, `org_unit:administer`
 * (`apps/web/src/features/admin/components/roles/role-privilege.ts`,
 * ADR-021). That label exists only in the browser. This file proves the
 * server behaves as if it had never heard of it, by running the two sides of
 * the classification against the SAME two routes:
 *
 * | | `GET /risks` (`risk:view`) | `POST /risks` (`risk:create`) |
 * |---|---|---|
 * | holder of all THREE governance permissions + `risk:view` | allowed | **refused** |
 * | holder of `risk:view` + `risk:create` and no governance permission at all | allowed | allowed |
 *
 * Read across, that is the whole claim: the classification confers nothing
 * (the maximally "privileged" identity is refused a permission it does not
 * hold) and its absence withholds nothing (the unclassified identity is
 * allowed a permission it does hold). A super-administrator shortcut keyed
 * on any of the three — under that name or any other — flips the one cell
 * that says "refused", and this test says which.
 *
 * ## Why this is not the same test as the structural sweep
 *
 * `test/unit/role-privilege-classification-boundary.spec.ts` proves the
 * classification is not NAMED anywhere in `apps/api/src`. That catches its
 * introduction, in every spelling this project has used for it, at the
 * moment it is written. It cannot catch a paraphrase that names no
 * identifier. This file cannot see a classification that exists and happens
 * to agree today, but it does see the only thing that ultimately matters —
 * whether the decision changes. Neither replaces the other.
 *
 * ## Why it is NOT the same test as the FR-019 boundary either
 *
 * `role-administer-user-boundary.spec.ts` asks whether one governance
 * permission implies another. This one asks whether governance permissions,
 * as a class, confer anything beyond themselves. The first would stay green
 * if `role:administer` silently granted `risk:create`; this one would not.
 *
 * ## Test marker prefixes
 *
 * F-45/F-54: `uniqueTestMarker` appends a 36-character UUID, and a prefix of
 * exactly 2 or 6 characters produces a 43-character base64url-looking marker
 * that `information-disclosure.spec.ts` reports as a leaked token. The
 * prefixes here are 15 and 11 characters.
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { buildContractTestApp, type ContractTestContext } from '../contract/support/contract-app';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createLocalUserFixture } from './support/fixtures';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

const API_PREFIX = '/api/v1';
const RISK_LIST = `${API_PREFIX}/risks`;
const RISK_CREATE = `${API_PREFIX}/risks`;

/** The exact three the web's `PRIVILEGED_PERMISSION_IDENTIFIERS` names. */
const GOVERNANCE_PERMISSIONS: readonly PermissionIdentifier[] = [
  'role:administer',
  'user:administer',
  'org_unit:administer',
];

describe('ADR-021 — the privilege classification changes no decision (015 FR-036, STATE §16.1 item 2)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  /** Holds ALL three governance permissions plus `risk:view`. Maximally "privileged" by the screen's criterion. */
  let classifiedAgent: ReturnType<typeof request.agent>;
  /** Holds `risk:view` and `risk:create`, and NONE of the three. Not classified at all. */
  let unclassifiedAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    const prisma = ctx.app.get(PrismaService);

    async function agentHolding(
      marker: string,
      identifiers: readonly PermissionIdentifier[],
    ): Promise<ReturnType<typeof request.agent>> {
      const role = await createRoleWithPermissionsFixture(prisma, identifiers, {
        name: `fixture-${marker}-${randomUUID()}`,
      });
      const user = await createLocalUserFixture(prisma, {
        email: `${uniqueTestMarker(marker)}@example.test`,
      });
      await assignRoleFixture(prisma, { user: user.user, role });

      const agent = request.agent(ctx.app.getHttpServer());
      const login = await agent
        .post(`${API_PREFIX}/auth/login`)
        .set('Origin', appOrigin)
        .send({ email: user.user.email, password: user.rawPassword });
      expect(login.status).toBe(200);
      return agent;
    }

    classifiedAgent = await agentHolding('privileged-role', [
      ...GOVERNANCE_PERMISSIONS,
      'risk:view',
    ]);
    unclassifiedAgent = await agentHolding('plain-role', ['risk:view', 'risk:create']);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('gives each identity exactly the permissions granted to it — no classification widens either set', async () => {
    const classified = await classifiedAgent
      .get(`${API_PREFIX}/auth/session`)
      .set('Origin', appOrigin);
    const unclassified = await unclassifiedAgent
      .get(`${API_PREFIX}/auth/session`)
      .set('Origin', appOrigin);
    expect(classified.status).toBe(200);
    expect(unclassified.status).toBe(200);

    const classifiedPermissions = [
      ...((classified.body as { permissions: readonly string[] }).permissions ?? []),
    ].sort();
    const unclassifiedPermissions = [
      ...((unclassified.body as { permissions: readonly string[] }).permissions ?? []),
    ].sort();

    // Exact sets, not `toContain`: an extra permission arriving from
    // anywhere — a classification, a super-admin shortcut, an inheritance
    // rule — fails here before any route is called.
    expect(classifiedPermissions).toEqual(
      ['risk:view', ...GOVERNANCE_PERMISSIONS].sort((a, b) => a.localeCompare(b)),
    );
    expect(unclassifiedPermissions).toEqual(['risk:create', 'risk:view']);
  });

  it('answers the same for both on a route gated by a permission BOTH hold (risk:view)', async () => {
    const classified = await classifiedAgent.get(RISK_LIST).set('Origin', appOrigin);
    const unclassified = await unclassifiedAgent.get(RISK_LIST).set('Origin', appOrigin);

    // Same decision, identical status. Whatever organizational scope leaves
    // in the payload is irrelevant here — this asserts the authorization
    // answer, which is the thing the classification must not touch.
    expect(classified.status).toBe(unclassified.status);
    expect(classified.status).not.toBe(403);
  });

  it('refuses the CLASSIFIED identity a permission it does not hold, and allows the UNCLASSIFIED one the same permission it does (risk:create)', async () => {
    const classified = await classifiedAgent.post(RISK_CREATE).set('Origin', appOrigin).send({});
    const unclassified = await unclassifiedAgent
      .post(RISK_CREATE)
      .set('Origin', appOrigin)
      .send({});

    /*
     * The cell that carries the whole claim. Holding all three governance
     * permissions — everything the screen calls "privilegiado" — buys
     * nothing here: `risk:create` was not granted, so the answer is 403.
     */
    expect(classified.status).toBe(403);

    /*
     * And the counter-control, so the 403 above cannot pass for the wrong
     * reason (a broken route, a rejected session): the identity the screen
     * would NOT classify at all gets past the guard on the same route, and
     * is stopped only by the validation pipe refusing an empty body. 400,
     * never 403.
     */
    expect(unclassified.status).toBe(400);
  });
});
