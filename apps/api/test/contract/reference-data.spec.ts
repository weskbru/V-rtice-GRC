/**
 * D-11 gap-coverage — `GET /risk-categories`, `GET /risk-types` and
 * `GET /risk-origins` (`RiskReferenceDataController`,
 * `contracts/platform.openapi.yaml` ~582/604/623) had NO test anywhere in
 * the repository before this dispatch, found by the same coverage audit
 * that surfaced the untested `/risk-methodology` and `GET /users` endpoints
 * (see `risk-methodology.spec.ts`/`directory-users.spec.ts`'s own header
 * comments).
 *
 * All three share one contract sentence, verbatim or near-verbatim:
 * "Requires an authenticated session; no additional permission" (FR-053).
 * No scope is mentioned for any of the three — unlike `/org-units` and
 * `/users`, these are organization-wide classification tables, not
 * per-record data — so this file does not assert any scope filtering, only
 * that the endpoint is reachable by ANY authenticated user regardless of
 * permission, and refuses an unauthenticated one.
 *
 * ## Why this file seeds its own rows rather than reading release data
 *
 * `risk_categories`/`risk_types`/`risk_origins` ARE release-seeded in a
 * real environment (ADR-008, `prisma/seed`), but the contract-test harness
 * (`test/integration/support/global-setup.ts`) only runs `prisma migrate
 * deploy` against `pharos_grc_test`, never `prisma db seed` — confirmed
 * empirically: the test database's three reference tables are truncated to
 * empty by `resetMutableTestData` and never repopulated. Depending on the
 * seed here would make every assertion in this file vacuous (`toHaveLength(0)`
 * passing regardless of whether the endpoint or its ordering/filtering is
 * correct). Each `describe` block therefore creates its own
 * active/inactive rows directly via `prisma.client`, exactly as
 * `createOrgUnitFixture`/`createUserFixture` (`support/fixtures.ts`) do for
 * their own tables, and no other spec file in this suite touches these
 * three tables (verified by grep), so the truncate-once-at-start-of-run
 * isolation this harness uses elsewhere is safe here too.
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface ReferenceDataItemBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly sortOrder: number;
  readonly isActive: boolean;
}

interface ProblemBody {
  readonly status: number;
}

function assertReferenceDataItemsShape(body: readonly ReferenceDataItemBody[]): void {
  expect(Array.isArray(body)).toBe(true);
  for (const item of body) {
    expect(typeof item.id).toBe('string');
    expect(typeof item.code).toBe('string');
    expect(typeof item.name).toBe('string');
    expect(typeof item.description).toBe('string');
    expect(typeof item.sortOrder).toBe('number');
    expect(item.isActive).toBe(true);
  }
  const sortOrders = body.map((item) => item.sortOrder);
  expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b));
}

/**
 * F-45 issue 1 (`docs/deferred-findings.md`) — this file's own header
 * explains why it seeds rather than reads release data: `global-setup.ts`
 * never seeds `pharos_grc_test`, and this suite runs every contract spec
 * file SEQUENTIALLY against that ONE database, truncated once at the start
 * of the whole run, never between files. Nine OTHER files also create
 * active `RiskCategory`/`RiskType`/`RiskOrigin` rows in that same,
 * never-truncated-between-files table — the original `toEqual(activeIds)`
 * compared the ENTIRE response to this describe block's own two ids,
 * silently assuming (never asserted, never true by contract) that no other
 * file's fixture rows would ever be present at the same time. Filtering the
 * response down to only the ids THIS block created proves the same two
 * things the original assertion proved — both fixture rows are present,
 * and they appear in the correct relative `sortOrder` order (`.filter`
 * preserves the response's own ordering, so a wrong relative order still
 * fails this) — without assuming exclusivity of a table nothing in this
 * suite's contract or code ever promised this describe block alone owns.
 */
function expectOwnActiveIdsInSortOrder(
  body: readonly ReferenceDataItemBody[],
  ownActiveIds: readonly string[],
): void {
  const ownIdsInResponseOrder = body
    .map((item) => item.id)
    .filter((id) => ownActiveIds.includes(id));
  expect(ownIdsInResponseOrder).toEqual(ownActiveIds);
}

describe('Reference data endpoints (GET /risk-categories, /risk-types, /risk-origins — contracts/platform.openapi.yaml)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    // A real, logged-in user holding NO role and therefore NO permission at
    // all — the contract is explicit that these endpoints require "no
    // additional permission".
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('reference-data-noperm')}@example.test`,
    });

    agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /risk-categories', () => {
    let activeIds: readonly string[];
    let inactiveId: string;

    beforeAll(async () => {
      const prisma = ctx.app.get(PrismaService);
      const marker = uniqueTestMarker('risk-categories');
      const secondId = randomUUID();
      const firstId = randomUUID();
      const inactiveRowId = randomUUID();

      // Deliberately out of natural creation order, so a passing "in
      // sortOrder order" assertion cannot be a coincidence of insertion
      // order.
      await prisma.client.riskCategory.create({
        data: {
          id: secondId,
          code: `${marker}-b`,
          name: 'Categoria B',
          description: 'Fixture category B.',
          sortOrder: 20,
          isActive: true,
        },
      });
      await prisma.client.riskCategory.create({
        data: {
          id: firstId,
          code: `${marker}-a`,
          name: 'Categoria A',
          description: 'Fixture category A.',
          sortOrder: 10,
          isActive: true,
        },
      });
      await prisma.client.riskCategory.create({
        data: {
          id: inactiveRowId,
          code: `${marker}-inactive`,
          name: 'Categoria inativa',
          description: 'Fixture inactive category.',
          sortOrder: 15,
          isActive: false,
        },
      });

      // F-45 issue 1 (`docs/deferred-findings.md`) — a real, active row this
      // describe block does NOT own, exactly reproducing what any of the
      // other nine files that write to this same, never-truncated-between-
      // files table already do in a real full run. `expectOwnActiveIdsInSortOrder`
      // below must ignore it; the old `toEqual(activeIds)` this replaced
      // would have failed the instant this row exists.
      await prisma.client.riskCategory.create({
        data: {
          id: randomUUID(),
          code: `${uniqueTestMarker('risk-categories-foreign')}`,
          name: 'Categoria de outro arquivo (ruído deliberado)',
          description: 'Simulates a fixture another spec file left in the shared table.',
          sortOrder: 5,
          isActive: true,
        },
      });

      activeIds = [firstId, secondId];
      inactiveId = inactiveRowId;
    });

    it('succeeds for an authenticated user holding NO permission at all', async () => {
      const response = await agent.get('/api/v1/risk-categories').set('Origin', appOrigin);
      expect(response.status).toBe(200);
    });

    it('returns exactly its own active categories, ReferenceDataItem-shaped, in sortOrder order, excluding the inactive one — even with an unrelated active row from another file present (F-45 issue 1)', async () => {
      const response = await agent.get('/api/v1/risk-categories').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as readonly ReferenceDataItemBody[];

      assertReferenceDataItemsShape(body);
      expectOwnActiveIdsInSortOrder(body, activeIds);
      expect(body.some((item) => item.id === inactiveId)).toBe(false);
    });

    it('includeInactive=true also returns the deactivated row', async () => {
      const response = await agent
        .get('/api/v1/risk-categories')
        .query({ includeInactive: true })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as readonly ReferenceDataItemBody[];
      expect(body.some((item) => item.id === inactiveId)).toBe(true);
    });

    it('refuses an unauthenticated caller with 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/risk-categories');
      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.body as ProblemBody;
      expect(body.status).toBe(401);
    });
  });

  describe('GET /risk-types', () => {
    let activeIds: readonly string[];
    let inactiveId: string;

    beforeAll(async () => {
      const prisma = ctx.app.get(PrismaService);
      const marker = uniqueTestMarker('risk-types');
      const secondId = randomUUID();
      const firstId = randomUUID();
      const inactiveRowId = randomUUID();

      await prisma.client.riskType.create({
        data: {
          id: secondId,
          code: `${marker}-b`,
          name: 'Tipo B',
          description: 'Fixture type B.',
          sortOrder: 20,
          isActive: true,
        },
      });
      await prisma.client.riskType.create({
        data: {
          id: firstId,
          code: `${marker}-a`,
          name: 'Tipo A',
          description: 'Fixture type A.',
          sortOrder: 10,
          isActive: true,
        },
      });
      await prisma.client.riskType.create({
        data: {
          id: inactiveRowId,
          code: `${marker}-inactive`,
          name: 'Tipo inativo',
          description: 'Fixture inactive type.',
          sortOrder: 15,
          isActive: false,
        },
      });

      activeIds = [firstId, secondId];
      inactiveId = inactiveRowId;
    });

    it('succeeds for an authenticated user holding NO permission at all', async () => {
      const response = await agent.get('/api/v1/risk-types').set('Origin', appOrigin);
      expect(response.status).toBe(200);
    });

    it('returns exactly the active types, ReferenceDataItem-shaped, in sortOrder order, excluding the inactive one by default', async () => {
      const response = await agent.get('/api/v1/risk-types').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as readonly ReferenceDataItemBody[];

      assertReferenceDataItemsShape(body);
      expectOwnActiveIdsInSortOrder(body, activeIds);
      expect(body.some((item) => item.id === inactiveId)).toBe(false);
    });

    it('refuses an unauthenticated caller with 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/risk-types');
      expect(response.status).toBe(401);
      const body = response.body as ProblemBody;
      expect(body.status).toBe(401);
    });
  });

  describe('GET /risk-origins', () => {
    let activeIds: readonly string[];
    let inactiveId: string;

    beforeAll(async () => {
      const prisma = ctx.app.get(PrismaService);
      const marker = uniqueTestMarker('risk-origins');
      const secondId = randomUUID();
      const firstId = randomUUID();
      const inactiveRowId = randomUUID();

      await prisma.client.riskOrigin.create({
        data: {
          id: secondId,
          code: `${marker}-b`,
          name: 'Origem B',
          description: 'Fixture origin B.',
          sortOrder: 20,
          isActive: true,
        },
      });
      await prisma.client.riskOrigin.create({
        data: {
          id: firstId,
          code: `${marker}-a`,
          name: 'Origem A',
          description: 'Fixture origin A.',
          sortOrder: 10,
          isActive: true,
        },
      });
      await prisma.client.riskOrigin.create({
        data: {
          id: inactiveRowId,
          code: `${marker}-inactive`,
          name: 'Origem inativa',
          description: 'Fixture inactive origin.',
          sortOrder: 15,
          isActive: false,
        },
      });

      activeIds = [firstId, secondId];
      inactiveId = inactiveRowId;
    });

    it('succeeds for an authenticated user holding NO permission at all', async () => {
      const response = await agent.get('/api/v1/risk-origins').set('Origin', appOrigin);
      expect(response.status).toBe(200);
    });

    it('returns exactly the active origins, ReferenceDataItem-shaped, in sortOrder order, excluding the inactive one by default', async () => {
      const response = await agent.get('/api/v1/risk-origins').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as readonly ReferenceDataItemBody[];

      assertReferenceDataItemsShape(body);
      expectOwnActiveIdsInSortOrder(body, activeIds);
      expect(body.some((item) => item.id === inactiveId)).toBe(false);
    });

    it('refuses an unauthenticated caller with 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/risk-origins');
      expect(response.status).toBe(401);
      const body = response.body as ProblemBody;
      expect(body.status).toBe(401);
    });
  });
});
