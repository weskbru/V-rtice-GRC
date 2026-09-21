/**
 * T101 — organizational scope on the register and on direct risk retrieval
 * (US3 AS6, FR-025, FR-090, FR-030, SC-015).
 *
 * Two independently scoped actors, one risk inside actor A's scope and
 * outside actor B's:
 *
 *   1. Actor A's register lists it; actor B's register does not, and
 *      actor B's `meta.total` does not count it either (not merely
 *      hidden from the page — genuinely excluded from the count).
 *   2. Actor A can `GET /risks/{id}` it (200); actor B cannot (404).
 *   3. The 404 actor B receives is BYTE-FOR-BYTE identical (status, title,
 *      type, detail) whether the id names a real, out-of-scope risk or a
 *      randomly generated id that names no risk at all — the refusal must
 *      not disclose which case occurred (FR-030).
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

interface RiskSummaryBody {
  readonly id: string;
}

interface RegisterPageBody {
  readonly data: readonly RiskSummaryBody[];
  readonly meta: { readonly total: number };
}

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly type: string;
  readonly detail: string;
}

describe('Organizational scope on the register and on direct retrieval (T101, FR-025, FR-030, FR-090)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let riskId: string;
  let riskOrgUnitId: string;
  let agentInScope: ReturnType<typeof request.agent>;
  let agentOutOfScope: ReturnType<typeof request.agent>;

  async function loginNewScopedActor(orgUnitId: string): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-scope-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-risk-scope-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return agent;
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnitInScope = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-scope-in'),
    });
    const orgUnitOutOfScope = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-scope-out'),
    });
    riskOrgUnitId = orgUnitInScope.id;

    const creatorRole = await createRoleWithPermissionsFixture(prisma, ['risk:create'], {
      name: `fixture-risk-scope-creator-role-${randomUUID()}`,
    });
    const creator = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-scope-creator')}@example.test`,
      primaryOrgUnitId: orgUnitInScope.id,
    });
    await assignRoleFixture(prisma, { user: creator, role: creatorRole });
    await grantUnitScopeFixture(prisma, { user: creator, orgUnitId: orgUnitInScope.id });

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-scope-owner')}@example.test`,
    });
    // F-CV-2: `owner` is a SEPARATE fixture from the two restricted actors
    // this file exists to test (`agentInScope`/`agentOutOfScope`, both
    // `risk:view`-only, each scoped to exactly one unit) — it only seeds
    // the risk those two probe, and is never itself the subject of an
    // assertion. Made eligible for the risk's OWN unit only; the two
    // restricted actors' permission/scope are untouched (Case B).
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnitInScope.id });
    const risk = await ctx.app.get(CreateRiskUseCase).execute({
      actorUserId: creator.id,
      title: 'Risco restrito a uma unidade',
      description: 'Não deve ser visível fora do seu escopo.',
      orgUnitId: orgUnitInScope.id,
      ownerUserId: owner.id,
    });
    riskId = risk.id;

    agentInScope = await loginNewScopedActor(orgUnitInScope.id);
    agentOutOfScope = await loginNewScopedActor(orgUnitOutOfScope.id);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists the risk for the in-scope actor but not for the out-of-scope actor (US3 AS6)', async () => {
    const inScopeResponse = await agentInScope
      .get('/api/v1/risks')
      .query({ orgUnitId: riskOrgUnitId })
      .set('Origin', appOrigin);
    expect(inScopeResponse.status).toBe(200);
    const inScopeBody = inScopeResponse.body as RegisterPageBody;
    expect(inScopeBody.data.some((row) => row.id === riskId)).toBe(true);

    const outOfScopeResponse = await agentOutOfScope.get('/api/v1/risks').set('Origin', appOrigin);
    expect(outOfScopeResponse.status).toBe(200);
    const outOfScopeBody = outOfScopeResponse.body as RegisterPageBody;
    expect(outOfScopeBody.data.some((row) => row.id === riskId)).toBe(false);
    // Excluded from the COUNT too, not merely off the current page.
    expect(outOfScopeBody.meta.total).toBe(0);
  });

  it("an org unit filter never widens the caller's scope: the out-of-scope actor still gets nothing when explicitly filtering for the risk's own unit", async () => {
    const response = await agentOutOfScope
      .get('/api/v1/risks')
      .query({ orgUnitId: riskOrgUnitId })
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as RegisterPageBody;
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it('allows direct retrieval for the in-scope actor (200) and refuses it for the out-of-scope actor (404)', async () => {
    const inScopeResponse = await agentInScope
      .get(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin);
    expect(inScopeResponse.status).toBe(200);

    const outOfScopeResponse = await agentOutOfScope
      .get(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin);
    expect(outOfScopeResponse.status).toBe(404);
  });

  it('the out-of-scope 404 does not disclose existence: identical to the 404 for a random, nonexistent id (FR-030)', async () => {
    const nonexistentId = randomUUID();

    const outOfScopeResponse = await agentOutOfScope
      .get(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin);
    const nonexistentResponse = await agentOutOfScope
      .get(`/api/v1/risks/${nonexistentId}`)
      .set('Origin', appOrigin);

    expect(outOfScopeResponse.status).toBe(404);
    expect(nonexistentResponse.status).toBe(404);

    const outOfScopeBody = outOfScopeResponse.body as ProblemBody;
    const nonexistentBody = nonexistentResponse.body as ProblemBody;

    expect(nonexistentBody.status).toBe(outOfScopeBody.status);
    expect(nonexistentBody.title).toBe(outOfScopeBody.title);
    expect(nonexistentBody.type).toBe(outOfScopeBody.type);
    // `detail` embeds the id the CALLER THEMSELF supplied in the URL —
    // comparing the two strings for equality would be the wrong check
    // (they necessarily differ, since `riskId` and `nonexistentId` differ)
    // and would not even be the right thing to require: echoing back an id
    // the client already typed discloses nothing new. What FR-030 actually
    // requires is that BOTH refusals follow the exact same template with
    // no extra, distinguishing content — proven by matching each against
    // the identical pattern, parameterized only by the id already known to
    // the caller.
    expect(outOfScopeBody.detail).toBe(`Risco ${riskId} não foi encontrado(a).`);
    expect(nonexistentBody.detail).toBe(`Risco ${nonexistentId} não foi encontrado(a).`);

    // FR-107: no internal detail leaks through either refusal.
    const raw = JSON.stringify(outOfScopeResponse.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
  });
});
