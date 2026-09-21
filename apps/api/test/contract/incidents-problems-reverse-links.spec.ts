/**
 * 013-incidents-problems-reverse-links — contract coverage for the four
 * new READ-ONLY reverse listings this phase adds:
 * `GET /risks/{riskId}/incidents`, `GET /risks/{riskId}/problems`,
 * `GET /assets/{assetId}/incidents`, `GET /processes/{processId}/incidents`.
 *
 * `modules/risk`/`modules/assets`/`modules/processes` never write
 * `IncidentRiskLink`/`ProblemRiskLink`/`IncidentAssetLink`/
 * `IncidentProcessLink` — every link row this file creates is written
 * directly via Prisma, exactly as `control-relationship-links.spec.ts`'s
 * own "GET risks" tests already do for the identical `RiskControlLink`
 * reverse-read shape, and `incident-problem-relationship-links.spec.ts`'s
 * fixtures do for `Incident`/`Problem` themselves.
 *
 * Per endpoint: succeeds for the resource's OWN view permission and
 * returns the declared minimal shape (`auto-validate-responses.ts`
 * additionally checks every response body against
 * `risks.openapi.yaml`/`assets.openapi.yaml`/`processes.openapi.yaml`
 * automatically, via `contract-app.ts`'s module-level `afterEach`); refuses
 * a caller lacking that permission (403); refuses an unauthenticated
 * caller (401); and answers a source record outside the caller's
 * organizational scope EXACTLY like a nonexistent one (404, ADR-020
 * part 4 non-disclosure) — proven by asserting both cases return the
 * identical status, mirroring `control-relationship-links.spec.ts`'s own
 * non-disclosure test.
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import {
  createLocalUserFixture,
  createOrgUnitFixture,
  createUserFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface IncidentRefBody {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: string;
}

interface ProblemRefBody {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: string;
}

interface RiskIncidentLinkBody {
  readonly id: string;
  readonly incident: IncidentRefBody;
  readonly linkedBy: { readonly id: string };
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

interface RiskProblemLinkBody {
  readonly id: string;
  readonly problem: ProblemRefBody;
  readonly linkedBy: { readonly id: string };
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

describe('013-incidents-problems-reverse-links — reverse read endpoints', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('reverse-link-contract-org'),
    });
    orgUnitId = orgUnit.id;
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('reverse-link-contract-owner')}@example.test`,
    });
    ownerUserId = owner.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
    targetOrgUnitId: string = orgUnitId,
  ): Promise<{ agent: ReturnType<typeof request.agent> }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('reverse-link-actor')}@example.test`,
      primaryOrgUnitId: targetOrgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-reverse-link-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: targetOrgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent };
  }

  async function createRiskRow(targetOrgUnitId: string = orgUnitId) {
    const prisma = ctx.app.get(PrismaService);
    return prisma.client.risk.create({
      data: {
        code: uniqueTestMarker('reverse-link-risk'),
        title: 'Risco para vínculo reverso',
        description: 'Descrição.',
        orgUnitId: targetOrgUnitId,
        ownerUserId,
        status: 'DRAFT',
        identifiedOn: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
  }

  async function createAssetRow(targetOrgUnitId: string = orgUnitId) {
    const prisma = ctx.app.get(PrismaService);
    return prisma.client.asset.create({
      data: {
        code: uniqueTestMarker('reverse-link-asset'),
        name: 'Ativo para vínculo reverso',
        orgUnitId: targetOrgUnitId,
        isActive: true,
      },
    });
  }

  async function createProcessRow(targetOrgUnitId: string = orgUnitId) {
    const prisma = ctx.app.get(PrismaService);
    return prisma.client.process.create({
      data: {
        code: uniqueTestMarker('reverse-link-process'),
        name: 'Processo para vínculo reverso',
        orgUnitId: targetOrgUnitId,
        isActive: true,
      },
    });
  }

  async function createIncidentRow(targetOrgUnitId: string = orgUnitId) {
    const prisma = ctx.app.get(PrismaService);
    return prisma.client.incident.create({
      data: {
        code: uniqueTestMarker('reverse-link-incident'),
        orgUnitId: targetOrgUnitId,
        title: 'Incidente para vínculo reverso',
        description: 'Descrição do incidente.',
        severity: 'HIGH',
        reportedByUserId: ownerUserId,
        ownerUserId,
        reportedOn: new Date('2026-02-01'),
      },
    });
  }

  async function createProblemRow(targetOrgUnitId: string = orgUnitId) {
    const prisma = ctx.app.get(PrismaService);
    return prisma.client.problem.create({
      data: {
        code: uniqueTestMarker('reverse-link-problem'),
        orgUnitId: targetOrgUnitId,
        title: 'Problema para vínculo reverso',
        description: 'Descrição do problema.',
        severity: 'HIGH',
        ownerUserId,
        identifiedOn: new Date('2026-02-01'),
      },
    });
  }

  // ---------------------------------------------------------------------
  // GET /risks/{riskId}/incidents
  // ---------------------------------------------------------------------

  describe('GET /risks/{riskId}/incidents', () => {
    it('succeeds for a caller holding risk:view and returns the declared minimal IncidentRef shape', async () => {
      const risk = await createRiskRow();
      const incident = await createIncidentRow();
      const prisma = ctx.app.get(PrismaService);
      await prisma.client.incidentRiskLink.create({
        data: {
          incidentId: incident.id,
          riskId: risk.id,
          linkedByUserId: ownerUserId,
          linkedAt: new Date(),
        },
      });

      const { agent } = await agentWithPermissions(['risk:view']);
      const response = await agent
        .get(`/api/v1/risks/${risk.id}/incidents`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      const body = response.body as readonly RiskIncidentLinkBody[];
      expect(body).toHaveLength(1);
      expect(body[0]!.incident.id).toBe(incident.id);
      expect(body[0]!.incident.code).toBe(incident.code);
      expect(body[0]!.incident.title).toBe(incident.title);
      expect(body[0]!.incident.status).toBe('OPEN');
      // ADR-020 part 4 — deliberately minimal: no `severity`, `description`,
      // `ownerUserId` or `orgUnitId` leak through this reverse read.
      expect(Object.keys(body[0]!.incident).sort()).toEqual(['code', 'id', 'status', 'title']);
    });

    it('refuses a caller lacking risk:view — 403', async () => {
      const risk = await createRiskRow();
      const { agent } = await agentWithPermissions([]);

      const response = await agent
        .get(`/api/v1/risks/${risk.id}/incidents`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/risks/${randomUUID()}/incidents`,
      );
      expect(response.status).toBe(401);
    });

    it('ADR-020 part 4 non-disclosure — a risk outside the caller scope answers exactly like a nonexistent risk (404)', async () => {
      const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('reverse-link-out-of-scope-org'),
      });
      const outOfScopeRisk = await createRiskRow(outOfScopeOrgUnit.id);
      const { agent } = await agentWithPermissions(['risk:view']);

      const outOfScopeResponse = await agent
        .get(`/api/v1/risks/${outOfScopeRisk.id}/incidents`)
        .set('Origin', appOrigin);
      const nonexistentResponse = await agent
        .get(`/api/v1/risks/${randomUUID()}/incidents`)
        .set('Origin', appOrigin);

      expect(outOfScopeResponse.status).toBe(404);
      expect(nonexistentResponse.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------
  // GET /risks/{riskId}/problems
  // ---------------------------------------------------------------------

  describe('GET /risks/{riskId}/problems', () => {
    it('succeeds for a caller holding risk:view and returns the declared minimal ProblemRef shape', async () => {
      const risk = await createRiskRow();
      const problem = await createProblemRow();
      const prisma = ctx.app.get(PrismaService);
      await prisma.client.problemRiskLink.create({
        data: {
          problemId: problem.id,
          riskId: risk.id,
          linkedByUserId: ownerUserId,
          linkedAt: new Date(),
        },
      });

      const { agent } = await agentWithPermissions(['risk:view']);
      const response = await agent
        .get(`/api/v1/risks/${risk.id}/problems`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as readonly RiskProblemLinkBody[];
      expect(body).toHaveLength(1);
      expect(body[0]!.problem.id).toBe(problem.id);
      expect(body[0]!.problem.status).toBe('OPEN');
      expect(Object.keys(body[0]!.problem).sort()).toEqual(['code', 'id', 'status', 'title']);
    });

    it('refuses a caller lacking risk:view — 403', async () => {
      const risk = await createRiskRow();
      const { agent } = await agentWithPermissions([]);

      const response = await agent
        .get(`/api/v1/risks/${risk.id}/problems`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/risks/${randomUUID()}/problems`,
      );
      expect(response.status).toBe(401);
    });

    it('ADR-020 part 4 non-disclosure — a risk outside the caller scope answers exactly like a nonexistent risk (404)', async () => {
      const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('reverse-link-out-of-scope-org-2'),
      });
      const outOfScopeRisk = await createRiskRow(outOfScopeOrgUnit.id);
      const { agent } = await agentWithPermissions(['risk:view']);

      const outOfScopeResponse = await agent
        .get(`/api/v1/risks/${outOfScopeRisk.id}/problems`)
        .set('Origin', appOrigin);
      const nonexistentResponse = await agent
        .get(`/api/v1/risks/${randomUUID()}/problems`)
        .set('Origin', appOrigin);

      expect(outOfScopeResponse.status).toBe(404);
      expect(nonexistentResponse.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------
  // GET /assets/{assetId}/incidents
  // ---------------------------------------------------------------------

  describe('GET /assets/{assetId}/incidents', () => {
    it('succeeds for a caller holding ONLY asset:view (no risk:view/incident:view at all) and returns the minimal shape', async () => {
      const asset = await createAssetRow();
      const incident = await createIncidentRow();
      const prisma = ctx.app.get(PrismaService);
      await prisma.client.incidentAssetLink.create({
        data: {
          incidentId: incident.id,
          assetId: asset.id,
          linkedByUserId: ownerUserId,
          linkedAt: new Date(),
        },
      });

      const { agent } = await agentWithPermissions(['asset:view']);
      const response = await agent
        .get(`/api/v1/assets/${asset.id}/incidents`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as readonly RiskIncidentLinkBody[];
      expect(body).toHaveLength(1);
      expect(body[0]!.incident.id).toBe(incident.id);
      expect(Object.keys(body[0]!.incident).sort()).toEqual(['code', 'id', 'status', 'title']);
    });

    it('refuses a caller lacking asset:view — 403', async () => {
      const asset = await createAssetRow();
      const { agent } = await agentWithPermissions([]);

      const response = await agent
        .get(`/api/v1/assets/${asset.id}/incidents`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/assets/${randomUUID()}/incidents`,
      );
      expect(response.status).toBe(401);
    });

    it('ADR-020 part 4 non-disclosure — an asset outside the caller scope answers exactly like a nonexistent asset (404)', async () => {
      const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('reverse-link-out-of-scope-org-3'),
      });
      const outOfScopeAsset = await createAssetRow(outOfScopeOrgUnit.id);
      const { agent } = await agentWithPermissions(['asset:view']);

      const outOfScopeResponse = await agent
        .get(`/api/v1/assets/${outOfScopeAsset.id}/incidents`)
        .set('Origin', appOrigin);
      const nonexistentResponse = await agent
        .get(`/api/v1/assets/${randomUUID()}/incidents`)
        .set('Origin', appOrigin);

      expect(outOfScopeResponse.status).toBe(404);
      expect(nonexistentResponse.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------
  // GET /processes/{processId}/incidents
  // ---------------------------------------------------------------------

  describe('GET /processes/{processId}/incidents', () => {
    it('succeeds for a caller holding ONLY process:view and returns the minimal shape', async () => {
      const process = await createProcessRow();
      const incident = await createIncidentRow();
      const prisma = ctx.app.get(PrismaService);
      await prisma.client.incidentProcessLink.create({
        data: {
          incidentId: incident.id,
          processId: process.id,
          linkedByUserId: ownerUserId,
          linkedAt: new Date(),
        },
      });

      const { agent } = await agentWithPermissions(['process:view']);
      const response = await agent
        .get(`/api/v1/processes/${process.id}/incidents`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as readonly RiskIncidentLinkBody[];
      expect(body).toHaveLength(1);
      expect(body[0]!.incident.id).toBe(incident.id);
      expect(Object.keys(body[0]!.incident).sort()).toEqual(['code', 'id', 'status', 'title']);
    });

    it('refuses a caller lacking process:view — 403', async () => {
      const process = await createProcessRow();
      const { agent } = await agentWithPermissions([]);

      const response = await agent
        .get(`/api/v1/processes/${process.id}/incidents`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/processes/${randomUUID()}/incidents`,
      );
      expect(response.status).toBe(401);
    });

    it('ADR-020 part 4 non-disclosure — a process outside the caller scope answers exactly like a nonexistent process (404)', async () => {
      const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('reverse-link-out-of-scope-org-4'),
      });
      const outOfScopeProcess = await createProcessRow(outOfScopeOrgUnit.id);
      const { agent } = await agentWithPermissions(['process:view']);

      const outOfScopeResponse = await agent
        .get(`/api/v1/processes/${outOfScopeProcess.id}/incidents`)
        .set('Origin', appOrigin);
      const nonexistentResponse = await agent
        .get(`/api/v1/processes/${randomUUID()}/incidents`)
        .set('Origin', appOrigin);

      expect(outOfScopeResponse.status).toBe(404);
      expect(nonexistentResponse.status).toBe(404);
    });
  });
});
