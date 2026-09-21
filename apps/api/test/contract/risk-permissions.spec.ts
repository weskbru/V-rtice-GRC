/**
 * T079 — `POST /api/v1/risks` and `PATCH /api/v1/risks/{riskId}` refuse a
 * caller who lacks `risk:create`/`risk:edit` (ADR-003: `PermissionGuard` is
 * the single decision path, checked BEFORE the controller body — and
 * therefore before any per-record existence/scope check ever runs).
 *
 * FR-030's non-disclosure requirement is proven by comparing the refusal
 * for a REAL risk id against the refusal for a RANDOM, nonexistent one:
 * both must be byte-for-byte the same shape (status/title/type/detail),
 * because the permission denial happens before the controller could ever
 * know whether either id refers to a real row.
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
  makeRiskAssignmentVisible,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import {
  createLocalUserFixture,
  createOrgUnitFixture,
  createUserFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly type: string;
  readonly detail: string;
}

describe('Risk permission enforcement (T079, FR-030, ADR-003)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let existingRiskId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-permissions-org'),
    });
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('rp-owner')}@example.test`,
    });
    // F-CV-2: `owner` here is a SEPARATE fixture from the restricted actor
    // this file exists to test (`loginAsUnprivilegedActor`, below) — it
    // only seeds the pre-existing risk the 403 tests target, and is never
    // itself the subject of an assertion. Made eligible; the restricted
    // actor's own permission set is untouched (Case B).
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });

    // An existing risk, seeded directly through the use case (not HTTP —
    // this test is about the UNPRIVILEGED caller below, not about proving
    // creation again, which T080 already covers).
    const authorizedActor = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('rp-privileged')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const privilegedRole = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:create', 'risk:edit', 'risk:view'],
      { name: `fixture-risk-permissions-privileged-role-${randomUUID()}` },
    );
    await assignRoleFixture(prisma, { user: authorizedActor, role: privilegedRole });
    await grantUnitScopeFixture(prisma, { user: authorizedActor, orgUnitId: orgUnit.id });

    const createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    const risk = await createRiskUseCase.execute({
      actorUserId: authorizedActor.id,
      title: 'Risco existente para o teste de permissão',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });
    existingRiskId = risk.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** A real, logged-in user holding `risk:view` (and organizational scope
   * over SOME unit — deliberately irrelevant to this test) but NEITHER
   * `risk:create` NOR `risk:edit`. */
  async function loginAsUnprivilegedActor(): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('rp-unpriv-org'),
    });
    // Short prefix deliberately: `IsEmail` enforces the 64-octet local-part
    // limit (RFC 5321), and `uniqueTestMarker` appends a full UUID (36
    // chars) — a longer prefix here previously pushed the address over that
    // limit and made `POST /auth/login` itself fail with 400 before this
    // test's actual subject (the 403 permission checks below) ever ran.
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('rp-unpriv')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const viewOnlyRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-rp-view-only-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role: viewOnlyRole });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return agent;
  }

  it('refuses POST /risks with 403 when the caller lacks risk:create', async () => {
    const agent = await loginAsUnprivilegedActor();

    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Tentativa não autorizada',
      description: 'Não deveria ser criado.',
      orgUnitId: randomUUID(),
      ownerUserId: randomUUID(),
    });

    expect(response.status).toBe(403);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(403);

    // No stack trace, no SQL fragment, no internal identifier (FR-107).
    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
  });

  it('refuses PATCH /risks/{riskId} with 403 when the caller lacks risk:edit — identically for a real risk and a nonexistent one (FR-030)', async () => {
    const agent = await loginAsUnprivilegedActor();
    const nonexistentRiskId = randomUUID();

    const responseForExistingRisk = await agent
      .patch(`/api/v1/risks/${existingRiskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', '"0"')
      .send({ title: 'Tentativa não autorizada' });

    const responseForNonexistentRisk = await agent
      .patch(`/api/v1/risks/${nonexistentRiskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', '"0"')
      .send({ title: 'Tentativa não autorizada' });

    expect(responseForExistingRisk.status).toBe(403);
    expect(responseForNonexistentRisk.status).toBe(403);

    const existingBody = responseForExistingRisk.body as ProblemBody;
    const nonexistentBody = responseForNonexistentRisk.body as ProblemBody;

    // The refusal cannot be used to probe whether `existingRiskId` is a
    // real risk: same status, title, type and detail regardless.
    expect(nonexistentBody.status).toBe(existingBody.status);
    expect(nonexistentBody.title).toBe(existingBody.title);
    expect(nonexistentBody.type).toBe(existingBody.type);
    expect(nonexistentBody.detail).toBe(existingBody.detail);
  });

  it('never discloses internal detail in either 403 body (FR-107)', async () => {
    const agent = await loginAsUnprivilegedActor();

    const response = await agent
      .patch(`/api/v1/risks/${existingRiskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', '"0"')
      .send({ title: 'x' });

    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
    expect(raw).not.toMatch(/passwordHash/i);
  });
});
