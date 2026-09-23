import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import {
  createLocalUserFixture,
  createMethodologyVersionFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface ScalePointBody {
  readonly value: number;
  readonly label: string;
}

interface MatrixCellBody {
  readonly probability: number;
  readonly impact: number;
  readonly score: number;
  readonly level: string;
}

interface LevelBandBody {
  readonly level: string;
  readonly minScore: number;
  readonly maxScore: number;
}

interface MethodologyVersionBody {
  readonly id: string;
  readonly versionNumber: number;
  readonly probabilityScale: readonly ScalePointBody[];
  readonly impactScale: readonly ScalePointBody[];
  readonly matrix: readonly MatrixCellBody[];
  readonly levelBands: readonly LevelBandBody[];
  readonly effectiveFrom: string;
  readonly isActive: boolean;
  readonly createdBy: { readonly id: string; readonly fullName: string; readonly email: string };
}

interface MethodologyVersionPageBody {
  readonly data: readonly MethodologyVersionBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

interface ProblemBody {
  readonly status: number;
  readonly title: string;
}

const SCALE_1_TO_5 = [1, 2, 3, 4, 5].map((value) => ({ value, label: `P${String(value)}` }));
const LEVEL_BANDS = [
  { level: 'LOW', minScore: 1, maxScore: 12 },
  { level: 'HIGH', minScore: 13, maxScore: 25 },
];
const MATRIX = SCALE_1_TO_5.flatMap((p) =>
  SCALE_1_TO_5.map((i) => {
    const score = p.value * i.value;
    return { probability: p.value, impact: i.value, score, level: score <= 12 ? 'LOW' : 'HIGH' };
  }),
);

function validPublishBody(overrides: Record<string, unknown> = {}) {
  return {
    probabilityScale: SCALE_1_TO_5,
    impactScale: SCALE_1_TO_5,
    matrix: MATRIX,
    levelBands: LEVEL_BANDS,
    ...overrides,
  };
}

describe('Risk methodology endpoints (GET /risk-methodology, GET/POST /risk-methodology/versions)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const seedActor = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-methodology-seed')}@example.test`,
    });
    await createMethodologyVersionFixture(prisma, seedActor.user.id);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function loginAsNoPermissionActor(): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-methodology-noperm')}@example.test`,
    });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return agent;
  }

  async function loginAsWrongPermissionActor(): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-methodology-wrongperm')}@example.test`,
    });
    const role = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-risk-methodology-wrongperm-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return agent;
  }

  async function loginAsMethodologyAdmin(): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-methodology-admin')}@example.test`,
    });
    const role = await createRoleWithPermissionsFixture(prisma, ['methodology:administer'], {
      name: `fixture-risk-methodology-admin-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return agent;
  }

  describe('GET /risk-methodology', () => {
    it('succeeds for an authenticated user holding NO permission at all — the exact caller the missing @NoPermissionRequired() bug refused', async () => {
      const agent = await loginAsNoPermissionActor();

      const response = await agent.get('/api/v1/risk-methodology').set('Origin', appOrigin);

      expect(response.status).toBe(200);
    });

    it('returns the active version shaped per RiskMethodologyVersion (scales, matrix, bands well-formed)', async () => {
      const agent = await loginAsNoPermissionActor();

      const response = await agent.get('/api/v1/risk-methodology').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as MethodologyVersionBody;

      expect(body.id).toBeTruthy();
      expect(typeof body.versionNumber).toBe('number');
      expect(body.isActive).toBe(true);
      expect(typeof body.effectiveFrom).toBe('string');
      expect(new Date(body.effectiveFrom).toString()).not.toBe('Invalid Date');

      expect(Array.isArray(body.probabilityScale)).toBe(true);
      expect(body.probabilityScale.length).toBeGreaterThan(0);
      for (const point of body.probabilityScale) {
        expect(typeof point.value).toBe('number');
        expect(typeof point.label).toBe('string');
      }

      expect(Array.isArray(body.impactScale)).toBe(true);
      expect(body.impactScale.length).toBeGreaterThan(0);

      expect(Array.isArray(body.matrix)).toBe(true);
      expect(body.matrix.length).toBe(body.probabilityScale.length * body.impactScale.length);
      for (const cell of body.matrix) {
        expect(typeof cell.probability).toBe('number');
        expect(typeof cell.impact).toBe('number');
        expect(typeof cell.score).toBe('number');
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(cell.level);
      }

      expect(Array.isArray(body.levelBands)).toBe(true);
      expect(body.levelBands.length).toBeGreaterThan(0);
      for (const band of body.levelBands) {
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(band.level);
        expect(band.minScore).toBeLessThanOrEqual(band.maxScore);
      }

      expect(body.createdBy.id).toBeTruthy();
    });

    it('refuses an unauthenticated caller with 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/risk-methodology');

      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.body as ProblemBody;
      expect(body.status).toBe(401);
    });
  });

  describe('GET /risk-methodology/versions', () => {
    it('succeeds for an authenticated user holding NO permission at all', async () => {
      const agent = await loginAsNoPermissionActor();

      const response = await agent
        .get('/api/v1/risk-methodology/versions')
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
    });

    it('returns the {data, meta} envelope with meta carrying real pagination values (the second original defect)', async () => {
      const prisma = ctx.app.get(PrismaService);
      const agent = await loginAsNoPermissionActor();

      const publisher = await createLocalUserFixture(prisma, {
        email: `${uniqueTestMarker('risk-methodology-versions-publisher')}@example.test`,
      });
      const { version: extraA } = await createMethodologyVersionFixture(prisma, publisher.user.id);
      const { version: extraB } = await createMethodologyVersionFixture(prisma, publisher.user.id);

      const realTotal = await prisma.client.riskMethodologyVersion.count();

      const response = await agent
        .get('/api/v1/risk-methodology/versions')
        .query({ page: 1, pageSize: 100 })
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as MethodologyVersionPageBody;

      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body).not.toHaveProperty('items');
      expect(Array.isArray(body.data)).toBe(true);

      expect(body.meta).toEqual({
        page: 1,
        pageSize: 100,
        total: realTotal,
        totalPages: Math.ceil(realTotal / 100),
      });

      const ids = body.data.map((v) => v.id);
      expect(ids).toContain(extraA.id);
      expect(ids).toContain(extraB.id);

      const versionNumbers = body.data.map((v) => v.versionNumber);
      const sorted = [...versionNumbers].sort((a, b) => b - a);
      expect(versionNumbers).toEqual(sorted);
    });

    it('refuses an unauthenticated caller with 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        '/api/v1/risk-methodology/versions',
      );

      expect(response.status).toBe(401);
      const body = response.body as ProblemBody;
      expect(body.status).toBe(401);
    });
  });

  describe('POST /risk-methodology/versions', () => {
    it('refuses a caller lacking methodology:administer with 403', async () => {
      const agent = await loginAsWrongPermissionActor();

      const response = await agent
        .post('/api/v1/risk-methodology/versions')
        .set('Origin', appOrigin)
        .send(validPublishBody());

      expect(response.status).toBe(403);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.body as ProblemBody;
      expect(body.status).toBe(403);
    });

    it('refuses an unauthenticated caller with 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/risk-methodology/versions')
        .set('Origin', appOrigin)
        .send(validPublishBody());

      expect(response.status).toBe(401);
    });

    it('accepts a caller holding methodology:administer, publishing a new version (201)', async () => {
      const agent = await loginAsMethodologyAdmin();

      const response = await agent
        .post('/api/v1/risk-methodology/versions')
        .set('Origin', appOrigin)
        .send(validPublishBody());

      expect(response.status).toBe(201);
      expect(response.headers.location).toBeTruthy();
      const body = response.body as MethodologyVersionBody;
      expect(body.id).toBeTruthy();
      expect(body.isActive).toBe(true);
      expect(body.matrix.length).toBe(SCALE_1_TO_5.length * SCALE_1_TO_5.length);
      expect(body.levelBands).toHaveLength(2);
    });
  });
});
