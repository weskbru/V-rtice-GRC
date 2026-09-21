/**
 * T100 — `GET /api/v1/risks` (US3, `contracts/risks.openapi.yaml`'s
 * `listRiskRegister` operation), proving the three properties CLAUDE.md
 * calls out as the ones that "costumam dar errado":
 *
 *   1. Page size is capped on the SERVER, not merely suggested to the
 *      client (FR-086) — requesting 10,000 rows never returns 10,000 rows.
 *   2. The total count is returned and matches the actual number of
 *      matching records (ADR-009).
 *   3. Ordering is stable across pages even when many rows tie on the
 *      requested sort field — no record is duplicated or omitted when
 *      paging through a tied result set (US3 AS1). This is deliberately
 *      exercised with EVERY seeded risk sharing the same `status` (the
 *      sort field under test) so `code` (the contract's documented
 *      tiebreaker) is the only thing keeping the order well-defined.
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
  readonly code: string;
  readonly descriptionExcerpt: string | null;
}

interface RegisterPageBody {
  readonly data: readonly RiskSummaryBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

describe('GET /risks — the risk register (T100, FR-086, FR-087, US3 AS1)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** A logged-in `risk:view`/`risk:create` actor scoped to a fresh org
   * unit, plus `seededCount` risks created under it — every seeded risk
   * shares the default `DRAFT` status, so a `sort=status` request ties
   * every row on the field under test. */
  async function seedActorWithRisks(
    seededCount: number,
  ): Promise<{ agent: ReturnType<typeof request.agent>; codes: string[] }> {
    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-register-org'),
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-register-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(prisma, ['risk:view', 'risk:create'], {
      name: `fixture-risk-register-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-register-owner')}@example.test`,
    });
    // F-CV-2: precondition owner for the register listing tests below —
    // not the object of any assertion here.
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
    const createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    const codes: string[] = [];
    for (let i = 0; i < seededCount; i += 1) {
      const risk = await createRiskUseCase.execute({
        actorUserId: fixture.user.id,
        title: `Risco de registro ${String(i)}`,
        description: 'Descrição do risco de teste do registro.',
        orgUnitId: orgUnit.id,
        ownerUserId: owner.id,
      });
      codes.push(risk.code);
    }

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, codes };
  }

  /** A logged-in actor scoped to a fresh org unit, with exactly ONE risk
   * created under it using the given `description` — for the
   * `descriptionExcerpt` truncation tests below, which need control over
   * the description text itself rather than the count of seeded risks. */
  async function seedActorWithRisk(
    description: string,
  ): Promise<{ agent: ReturnType<typeof request.agent>; code: string }> {
    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-register-excerpt-org'),
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-register-excerpt-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(prisma, ['risk:view', 'risk:create'], {
      name: `fixture-risk-register-excerpt-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-register-excerpt-owner')}@example.test`,
    });
    // F-CV-2: precondition owner for the excerpt-truncation tests below —
    // not the object of any assertion here.
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
    const createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    const risk = await createRiskUseCase.execute({
      actorUserId: fixture.user.id,
      title: 'Risco de registro com descrição para prévia',
      description,
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, code: risk.code };
  }

  it('returns a non-null descriptionExcerpt for a risk created with a description', async () => {
    const { agent, code } = await seedActorWithRisk(
      'Descrição breve do risco para a prévia da lista.',
    );

    const response = await agent.get('/api/v1/risks').set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as RegisterPageBody;
    const row = body.data.find((candidate) => candidate.code === code);
    expect(row).toBeDefined();
    expect(row?.descriptionExcerpt).not.toBeNull();
  });

  it('truncates a description longer than 200 characters to EXACTLY 200 characters, server-side', async () => {
    const longDescription = 'A'.repeat(250);
    const { agent, code } = await seedActorWithRisk(longDescription);

    const response = await agent.get('/api/v1/risks').set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as RegisterPageBody;
    const row = body.data.find((candidate) => candidate.code === code);
    expect(row).toBeDefined();
    expect(row?.descriptionExcerpt).not.toBeNull();
    expect(row?.descriptionExcerpt?.length).toBe(200);
    expect(row?.descriptionExcerpt).toBe(longDescription.slice(0, 200));
  });

  it('never returns more rows than the server-enforced cap, even when 10,000 are requested (FR-086)', async () => {
    const { agent } = await seedActorWithRisks(3);

    const response = await agent
      .get('/api/v1/risks')
      .query({ pageSize: 10000 })
      .set('Origin', appOrigin);

    // The cap is enforced by the server regardless of HOW it is enforced:
    // either the request is refused outright (this DTO's `@Max(100)`, the
    // strictest possible form of "never suggested to the client") or the
    // response is silently truncated to the cap. Either way, 10,000 rows
    // are never returned.
    if (response.status === 200) {
      const body = response.body as RegisterPageBody;
      expect(body.data.length).toBeLessThanOrEqual(100);
      expect(body.meta.pageSize).toBeLessThanOrEqual(100);
    } else {
      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
    }
  });

  it('returns a visible total that matches the actual number of matching records (ADR-009)', async () => {
    const { agent, codes } = await seedActorWithRisks(7);

    const response = await agent
      .get('/api/v1/risks')
      .query({ pageSize: 3 })
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as RegisterPageBody;
    expect(body.data.length).toBe(3);
    expect(body.meta.total).toBe(codes.length);
    expect(body.meta.totalPages).toBe(Math.ceil(codes.length / 3));
  });

  it('pages through a fully-tied sort field with no record duplicated or omitted (US3 AS1)', async () => {
    const seededCount = 23;
    const { agent, codes } = await seedActorWithRisks(seededCount);
    const pageSize = 5;
    const expectedPages = Math.ceil(seededCount / pageSize);

    const seenIds = new Set<string>();
    const seenCodes: string[] = [];

    for (let page = 1; page <= expectedPages; page += 1) {
      // Every seeded risk is `DRAFT` — sorting by `status` ties ALL of
      // them, so only the contract's documented `code` tiebreaker keeps
      // page boundaries well-defined.
      const response = await agent
        .get('/api/v1/risks')
        .query({ page, pageSize, sort: 'status', direction: 'asc' })
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as RegisterPageBody;
      expect(body.meta.total).toBe(seededCount);

      for (const row of body.data) {
        expect(seenIds.has(row.id)).toBe(false); // never duplicated across pages
        seenIds.add(row.id);
        seenCodes.push(row.code);
      }
    }

    // Nothing omitted: every seeded risk appeared exactly once.
    expect(seenIds.size).toBe(seededCount);
    expect(new Set(seenCodes).size).toBe(seededCount);
    for (const code of codes) {
      expect(seenCodes).toContain(code);
    }

    // The tiebreaker actually produced a well-defined total order: codes
    // collected across pages, in page order, are monotonically increasing
    // (risk codes are assigned from a strictly increasing per-year
    // sequence, `domain/risk-code.ts`).
    const sorted = [...seenCodes].sort();
    expect(seenCodes).toEqual(sorted);
  });
});
