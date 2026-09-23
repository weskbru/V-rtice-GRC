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
