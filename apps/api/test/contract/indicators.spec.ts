import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
  grantUnitScopeFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture, createOrgUnitFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ProblemBody {
  readonly status: number;
  readonly title?: string;
  readonly detail?: string;
  readonly type?: string;
}

interface IndicatorDefinitionBody {
  readonly id: string;
  readonly code: string;
  readonly metricKey: string;
  readonly name: string;
  readonly description: string;
  readonly owner: { readonly id: string; readonly fullName: string };
  readonly thresholdComparator: string | null;
  readonly thresholdValue: number | null;
  readonly isActive: boolean;
}

interface IndicatorMetricCatalogEntryBody {
  readonly metricKey: string;
  readonly defaultLabel: string;
  readonly sourcePermission: string;
  readonly scopeApplicability: 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';
  readonly shape: 'SINGLE_VALUE' | 'BY_BUCKET';
  readonly hasDefinition: boolean;
}

interface IndicatorDefinitionPageBody {
  readonly data: readonly IndicatorDefinitionBody[];
  readonly meta: { readonly page: number; readonly pageSize: number; readonly total: number };
}

interface IndicatorCurrentValueBody {
  readonly metricKey: string;
  readonly shape: 'SINGLE_VALUE' | 'BY_BUCKET';
  readonly scopeApplicability: 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';
  readonly value: number | null;
  readonly valueByBucket: Record<string, number> | null;
  readonly definition: IndicatorDefinitionBody | null;
  readonly computedAt: string;
}

interface IndicatorMeasurementBody {
  readonly id: string;
  readonly metricKey: string;
  readonly value: number | null;
  readonly valueByBucket: Record<string, number> | null;
  readonly breached: boolean;
  readonly computedAt: string;
  readonly computedBy: { readonly id: string; readonly fullName: string };
}

interface IndicatorMeasurementPageBody {
  readonly data: readonly IndicatorMeasurementBody[];
  readonly meta: { readonly page: number; readonly pageSize: number; readonly total: number };
}

describe('Indicator contract (US1, 009-indicators-reports)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('indicator-contract-org'),
    });
    orgUnitId = orgUnit.id;
    const { user: owner } = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('indicator-contract-owner')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    ownerUserId = owner.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('indicator-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: uniqueTestMarker('fixture-indicator-role'),
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, userId: fixture.user.id };
  }

  async function agentWithGlobalScope(
    permissions: readonly PermissionIdentifier[],
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('indicator-global-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: uniqueTestMarker('fixture-indicator-global-role'),
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantGlobalScopeFixture(prisma, { user: fixture.user });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, userId: fixture.user.id };
  }

  function validCreateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      metricKey: 'CONTROL_INACTIVE_COUNT',
      name: 'Controles inativos',
      description: 'Quantidade de controles inativos no escopo do chamador.',
      ownerUserId,
      ...overrides,
    };
  }

  describe('POST /indicators', () => {
    it('succeeds for a caller holding indicator:create and returns the declared shape', async () => {
      const { agent } = await agentWithPermissions(['indicator:create', 'indicator:view']);
      const response = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'ASSET_INACTIVE_COUNT' }));

      expect(response.status).toBe(201);
      const body = response.body as IndicatorDefinitionBody;
      expect(body.id).toBeTruthy();
      expect(body.code).toMatch(/^IND-\d{4}-\d{4,}$/);
      expect(body.metricKey).toBe('ASSET_INACTIVE_COUNT');
      expect(body.owner.id).toBe(ownerUserId);
      expect(body.thresholdComparator).toBeNull();
      expect(body.thresholdValue).toBeNull();
      expect(body.isActive).toBe(true);
    });

    it('accepts a threshold when comparator and value are both supplied (Invariant T1, happy path)', async () => {
      const { agent } = await agentWithPermissions(['indicator:create', 'indicator:view']);
      const response = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(
          validCreateBody({
            metricKey: 'PROCESS_INACTIVE_COUNT',
            thresholdComparator: 'GTE',
            thresholdValue: 5,
          }),
        );

      expect(response.status).toBe(201);
      const body = response.body as IndicatorDefinitionBody;
      expect(body.thresholdComparator).toBe('GTE');
      expect(body.thresholdValue).toBe(5);
    });

    it('rejects a comparator supplied without a value — Invariant T1, 422', async () => {
      const { agent } = await agentWithPermissions(['indicator:create', 'indicator:view']);
      const response = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'CONTROL_INACTIVE_COUNT', thresholdComparator: 'GTE' }));

      expect(response.status).toBe(422);
    });

    it('rejects a value supplied without a comparator — Invariant T1, 422', async () => {
      const { agent } = await agentWithPermissions(['indicator:create', 'indicator:view']);
      const response = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'CONTROL_INACTIVE_COUNT', thresholdValue: 5 }));

      expect(response.status).toBe(422);
    });

    it('rejects an unknown metricKey — 422, not 404 (write path, FR distinct from the read path)', async () => {
      const { agent } = await agentWithPermissions(['indicator:create', 'indicator:view']);
      const response = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'NOT_A_REAL_METRIC_KEY' }));

      expect(response.status).toBe(422);
    });

    it('rejects a second definition for an already-configured metricKey — 422', async () => {
      const { agent } = await agentWithPermissions(['indicator:create', 'indicator:view']);
      const first = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'CONTROL_INACTIVE_COUNT' }));
      expect(first.status).toBe(201);

      const second = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'CONTROL_INACTIVE_COUNT' }));
      expect(second.status).toBe(422);
    });

    it('refuses a caller lacking indicator:create — 403', async () => {
      const { agent } = await agentWithPermissions(['indicator:view']);
      const response = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'AUDIT_ENGAGEMENT_OPEN_COUNT' }));
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'AUDIT_ENGAGEMENT_OPEN_COUNT' }));
      expect(response.status).toBe(401);
      expect((response.body as ProblemBody).status).toBe(401);
    });

    it('emits a distinct indicator.created audit event on success', async () => {
      const { agent } = await agentWithPermissions(['indicator:create', 'indicator:view']);
      const response = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'INCIDENT_OPEN_COUNT_BY_SEVERITY' }));
      expect(response.status).toBe(201);
      const body = response.body as IndicatorDefinitionBody;

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: body.id, action: 'indicator.created' },
      });
      expect(auditRow).not.toBeNull();
    });
  });

  describe('GET /indicators', () => {
    it('responds with the {data, meta} envelope, never {items}', async () => {
      const { agent } = await agentWithPermissions(['indicator:create', 'indicator:view']);
      await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'PROBLEM_OPEN_COUNT_BY_SEVERITY' }));

      const response = await agent.get('/api/v1/indicators').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as IndicatorDefinitionPageBody;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toMatchObject({ page: 1, pageSize: 20 });
      expect((body as unknown as { items?: unknown }).items).toBeUndefined();
      expect(body.data.some((item) => item.metricKey === 'PROBLEM_OPEN_COUNT_BY_SEVERITY')).toBe(
        true,
      );
    });

    it('refuses a caller lacking indicator:view — 403', async () => {
      const { agent } = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/indicators').set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/indicators')
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /indicators/{metricKey}/current', () => {
    it('computes a SINGLE_VALUE, ORGANIZATIONAL_UNIT metric for a caller holding indicator:view + the source permission', async () => {
      const { agent } = await agentWithPermissions(['indicator:view', 'control:view']);
      const response = await agent
        .get('/api/v1/indicators/CONTROL_INACTIVE_COUNT/current')
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as IndicatorCurrentValueBody;
      expect(body.metricKey).toBe('CONTROL_INACTIVE_COUNT');
      expect(body.shape).toBe('SINGLE_VALUE');
      expect(body.scopeApplicability).toBe('ORGANIZATIONAL_UNIT');
      expect(typeof body.value === 'number' || body.value === null).toBe(true);
      expect(body.valueByBucket).toBeNull();
      expect(body.computedAt).toBeTruthy();
    });

    it('computes a BY_BUCKET metric with a zero-filled bucket map', async () => {
      const { agent } = await agentWithPermissions(['indicator:view', 'risk:view']);
      const response = await agent
        .get('/api/v1/indicators/RISK_TOTAL_BY_LEVEL/current')
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as IndicatorCurrentValueBody;
      expect(body.shape).toBe('BY_BUCKET');
      expect(body.value).toBeNull();
      expect(body.valueByBucket).not.toBeNull();
    });

    it('COMPLIANCE_PERCENTAGE declares ORGANIZATION_WIDE — the one key with no organizational-unit scope (research.md D-8)', async () => {
      const { agent } = await agentWithPermissions(['indicator:view', 'compliance:view']);
      const response = await agent
        .get('/api/v1/indicators/COMPLIANCE_PERCENTAGE/current')
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as IndicatorCurrentValueBody;
      expect(body.scopeApplicability).toBe('ORGANIZATION_WIDE');
    });

    it('refuses a caller lacking indicator:view — 403, before the key is even looked up', async () => {
      const { agent } = await agentWithPermissions(['risk:view']);
      const response = await agent
        .get('/api/v1/indicators/RISK_TOTAL_BY_LEVEL/current')
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('holds indicator:view but lacks the source permission — 403, naming the missing permission', async () => {
      const { agent } = await agentWithPermissions(['indicator:view']);
      const response = await agent
        .get('/api/v1/indicators/RISK_TOTAL_BY_LEVEL/current')
        .set('Origin', appOrigin);

      expect(response.status).toBe(403);
      const body = response.body as ProblemBody;
      expect(body.detail).toContain('risk:view');
    });

    it('an unknown metricKey is 404, never 400 — the catalog is the closed registry (FR-010)', async () => {
      const { agent } = await agentWithPermissions(['indicator:view']);
      const response = await agent
        .get('/api/v1/indicators/NOT_A_REAL_METRIC_KEY/current')
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/indicators/CONTROL_INACTIVE_COUNT/current')
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });

    it('reflects a configured definition (threshold) in the response, and null when none exists', async () => {
      const { agent: creator } = await agentWithPermissions(['indicator:create', 'indicator:view']);
      await creator
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(
          validCreateBody({
            metricKey: 'FINDING_OPEN_COUNT_BY_SEVERITY',
            thresholdComparator: 'GTE',
            thresholdValue: 1,
          }),
        );

      const { agent: reader } = await agentWithPermissions(['indicator:view', 'finding:view']);
      const withDefinition = await reader
        .get('/api/v1/indicators/FINDING_OPEN_COUNT_BY_SEVERITY/current')
        .set('Origin', appOrigin);
      expect(withDefinition.status).toBe(200);
      const withDefinitionBody = withDefinition.body as IndicatorCurrentValueBody;
      expect(withDefinitionBody.definition).not.toBeNull();
      expect(withDefinitionBody.definition?.thresholdComparator).toBe('GTE');

      const { agent: readerNoDefinition } = await agentWithPermissions([
        'indicator:view',
        'action:view',
      ]);
      const withoutDefinition = await readerNoDefinition
        .get('/api/v1/indicators/ACTION_OVERDUE_COUNT/current')
        .set('Origin', appOrigin);
      expect(withoutDefinition.status).toBe(200);
      expect((withoutDefinition.body as IndicatorCurrentValueBody).definition).toBeNull();
    });
  });

  describe('POST /indicators/{metricKey}/measurements', () => {
    it('computes and permanently records one point for a GLOBAL-scope caller holding indicator:edit', async () => {
      const { agent } = await agentWithGlobalScope(['indicator:edit']);
      const response = await agent
        .post('/api/v1/indicators/CONTROL_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin)
        .send({});

      expect(response.status).toBe(201);
      const body = response.body as IndicatorMeasurementBody;
      expect(body.id).toBeTruthy();
      expect(body.metricKey).toBe('CONTROL_INACTIVE_COUNT');
      expect(typeof body.breached).toBe('boolean');
      expect(body.computedAt).toBeTruthy();
      expect(body.computedBy.id).toBeTruthy();
      expect(typeof body.value === 'number' || body.value === null).toBe(true);
      expect(body.valueByBucket).toBeNull();
    });

    it('refuses a caller with UNIT scope — 403, even holding indicator:edit (research.md D-6)', async () => {
      const { agent } = await agentWithPermissions(['indicator:edit']);
      const response = await agent
        .post('/api/v1/indicators/CONTROL_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(403);
    });

    it('refuses a GLOBAL-scope caller lacking indicator:edit — 403', async () => {
      const { agent } = await agentWithGlobalScope(['indicator:view']);
      const response = await agent
        .post('/api/v1/indicators/CONTROL_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(403);
    });

    it('an unknown metricKey is 404', async () => {
      const { agent } = await agentWithGlobalScope(['indicator:edit']);
      const response = await agent
        .post('/api/v1/indicators/NOT_A_REAL_METRIC_KEY/measurements')
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(404);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/indicators/CONTROL_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(401);
    });

    it('emits a distinct indicator_measurement.created audit event on success', async () => {
      const { agent } = await agentWithGlobalScope(['indicator:edit']);
      const response = await agent
        .post('/api/v1/indicators/ASSET_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(201);
      const body = response.body as IndicatorMeasurementBody;

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: body.id, action: 'indicator_measurement.created' },
      });
      expect(auditRow).not.toBeNull();
    });

    it('declares no PATCH/PUT/DELETE on this resource — routing 404/405, never 403 (SC-002)', async () => {
      const { agent } = await agentWithGlobalScope(['indicator:edit']);
      const path = '/api/v1/indicators/CONTROL_INACTIVE_COUNT/measurements';

      const patchResponse = await agent.patch(path).set('Origin', appOrigin).send({});
      const putResponse = await agent.put(path).set('Origin', appOrigin).send({});
      const deleteResponse = await agent.delete(path).set('Origin', appOrigin);

      for (const response of [patchResponse, putResponse, deleteResponse]) {
        expect([404, 405]).toContain(response.status);
        expect(response.status).not.toBe(403);
      }
    });
  });

  describe('GET /indicators/{metricKey}/measurements', () => {
    it('responds with the {data, meta} envelope, chronological oldest-first, for a GLOBAL-scope caller', async () => {
      const { agent } = await agentWithGlobalScope(['indicator:edit', 'indicator:view']);
      const first = await agent
        .post('/api/v1/indicators/PROCESS_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin)
        .send({});
      expect(first.status).toBe(201);
      const second = await agent
        .post('/api/v1/indicators/PROCESS_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin)
        .send({});
      expect(second.status).toBe(201);
      const firstId = (first.body as IndicatorMeasurementBody).id;
      const secondId = (second.body as IndicatorMeasurementBody).id;

      const response = await agent
        .get('/api/v1/indicators/PROCESS_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin)
        .query({ pageSize: 100 });

      expect(response.status).toBe(200);
      const body = response.body as IndicatorMeasurementPageBody;
      expect(Array.isArray(body.data)).toBe(true);
      expect((body as unknown as { items?: unknown }).items).toBeUndefined();
      expect(body.meta).toMatchObject({ pageSize: 100 });

      const firstIndex = body.data.findIndex((item) => item.id === firstId);
      const secondIndex = body.data.findIndex((item) => item.id === secondId);
      expect(firstIndex).toBeGreaterThanOrEqual(0);
      expect(secondIndex).toBeGreaterThan(firstIndex);
      expect(body.data.every((item) => item.metricKey === 'PROCESS_INACTIVE_COUNT')).toBe(true);
    });

    it('refuses a caller with UNIT scope — 403, even holding indicator:view (research.md D-6)', async () => {
      const { agent } = await agentWithPermissions(['indicator:view']);
      const response = await agent
        .get('/api/v1/indicators/CONTROL_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses a GLOBAL-scope caller lacking indicator:view — 403', async () => {
      const { agent } = await agentWithGlobalScope([]);
      const response = await agent
        .get('/api/v1/indicators/CONTROL_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('an unknown metricKey is 404', async () => {
      const { agent } = await agentWithGlobalScope(['indicator:view']);
      const response = await agent
        .get('/api/v1/indicators/NOT_A_REAL_METRIC_KEY/measurements')
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/indicators/CONTROL_INACTIVE_COUNT/measurements')
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /indicators/{definitionId}', () => {
    let definitionId: string;

    beforeAll(async () => {
      const { agent } = await agentWithPermissions(['indicator:create', 'indicator:view']);
      const response = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'RISK_TREATMENT_OVERDUE_COUNT' }));
      expect(response.status).toBe(201);
      definitionId = (response.body as IndicatorDefinitionBody).id;
    });

    it('returns the declared shape for a caller holding indicator:view', async () => {
      const { agent } = await agentWithPermissions(['indicator:view']);
      const response = await agent
        .get(`/api/v1/indicators/${definitionId}`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as IndicatorDefinitionBody;
      expect(body.id).toBe(definitionId);
      expect(body.metricKey).toBe('RISK_TREATMENT_OVERDUE_COUNT');
      expect(body.owner.id).toBe(ownerUserId);
    });

    it('an unknown definitionId is 404', async () => {
      const { agent } = await agentWithPermissions(['indicator:view']);
      const response = await agent
        .get('/api/v1/indicators/00000000-0000-0000-0000-000000000000')
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('refuses a caller lacking indicator:view — 403', async () => {
      const { agent } = await agentWithPermissions([]);
      const response = await agent
        .get(`/api/v1/indicators/${definitionId}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/v1/indicators/${definitionId}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /indicators/{definitionId}', () => {
    let generalDefinitionId: string;
    let thresholdDefinitionId: string;
    let alternateOwnerUserId: string;

    beforeAll(async () => {
      const prisma = ctx.app.get(PrismaService);
      const { user: alternateOwner } = await createLocalUserFixture(prisma, {
        email: `${uniqueTestMarker('indicator-alt-owner')}@example.test`,
        primaryOrgUnitId: orgUnitId,
      });
      alternateOwnerUserId = alternateOwner.id;

      const { agent } = await agentWithPermissions(['indicator:create', 'indicator:view']);

      const generalResponse = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'COMPLIANCE_PERCENTAGE' }));
      expect(generalResponse.status).toBe(201);
      generalDefinitionId = (generalResponse.body as IndicatorDefinitionBody).id;

      const thresholdResponse = await agent
        .post('/api/v1/indicators')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKey: 'AUDIT_ENGAGEMENT_OPEN_COUNT' }));
      expect(thresholdResponse.status).toBe(201);
      thresholdDefinitionId = (thresholdResponse.body as IndicatorDefinitionBody).id;
    });

    it('edits name and description and returns the declared shape', async () => {
      const { agent } = await agentWithPermissions(['indicator:edit', 'indicator:view']);
      const response = await agent
        .patch(`/api/v1/indicators/${generalDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ name: 'Percentual de conformidade (editado)', description: 'Nova descrição.' });

      expect(response.status).toBe(200);
      const body = response.body as IndicatorDefinitionBody;
      expect(body.id).toBe(generalDefinitionId);
      expect(body.name).toBe('Percentual de conformidade (editado)');
      expect(body.description).toBe('Nova descrição.');
      expect(body.metricKey).toBe('COMPLIANCE_PERCENTAGE');
    });

    it('edits the owner', async () => {
      const { agent } = await agentWithPermissions(['indicator:edit', 'indicator:view']);
      const response = await agent
        .patch(`/api/v1/indicators/${generalDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ ownerUserId: alternateOwnerUserId });

      expect(response.status).toBe(200);
      const body = response.body as IndicatorDefinitionBody;
      expect(body.owner.id).toBe(alternateOwnerUserId);
    });

    it('rejects an attempt to change metricKey — 400, unknown property (metricKey is immutable)', async () => {
      const { agent } = await agentWithPermissions(['indicator:edit', 'indicator:view']);
      const response = await agent
        .patch(`/api/v1/indicators/${generalDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ metricKey: 'ACTION_OVERDUE_COUNT' });

      expect(response.status).toBe(400);
    });

    it('an unknown definitionId is 404', async () => {
      const { agent } = await agentWithPermissions(['indicator:edit']);
      const response = await agent
        .patch('/api/v1/indicators/00000000-0000-0000-0000-000000000000')
        .set('Origin', appOrigin)
        .send({ name: 'Não importa' });
      expect(response.status).toBe(404);
    });

    it('refuses a caller lacking indicator:edit — 403', async () => {
      const { agent } = await agentWithPermissions(['indicator:view']);
      const response = await agent
        .patch(`/api/v1/indicators/${generalDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ name: 'Não importa' });
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .patch(`/api/v1/indicators/${generalDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ name: 'Não importa' });
      expect(response.status).toBe(401);
    });

    it('rejects a comparator supplied without a value — Invariant T1, 422 (`thresholdDefinitionId` starts with no threshold)', async () => {
      const { agent } = await agentWithPermissions(['indicator:edit']);
      const response = await agent
        .patch(`/api/v1/indicators/${thresholdDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ thresholdComparator: 'GTE' });
      expect(response.status).toBe(422);
    });

    it('rejects a value supplied without a comparator — Invariant T1, 422', async () => {
      const { agent } = await agentWithPermissions(['indicator:edit']);
      const response = await agent
        .patch(`/api/v1/indicators/${thresholdDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ thresholdValue: 5 });
      expect(response.status).toBe(422);
    });

    it('accepts setting both threshold fields together', async () => {
      const { agent } = await agentWithPermissions(['indicator:edit', 'indicator:view']);
      const response = await agent
        .patch(`/api/v1/indicators/${thresholdDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ thresholdComparator: 'GTE', thresholdValue: 5 });

      expect(response.status).toBe(200);
      const body = response.body as IndicatorDefinitionBody;
      expect(body.thresholdComparator).toBe('GTE');
      expect(body.thresholdValue).toBe(5);
    });

    it('rejects clearing only the comparator while a value remains configured — Invariant T1, 422 (chained off the previous test — both fields are configured at this point)', async () => {
      const { agent } = await agentWithPermissions(['indicator:edit']);
      const response = await agent
        .patch(`/api/v1/indicators/${thresholdDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ thresholdComparator: null });
      expect(response.status).toBe(422);
    });

    it('clears an existing threshold by sending both fields as null', async () => {
      const { agent } = await agentWithPermissions(['indicator:edit', 'indicator:view']);
      const response = await agent
        .patch(`/api/v1/indicators/${thresholdDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ thresholdComparator: null, thresholdValue: null });

      expect(response.status).toBe(200);
      const body = response.body as IndicatorDefinitionBody;
      expect(body.thresholdComparator).toBeNull();
      expect(body.thresholdValue).toBeNull();
    });
  });

  describe('GET /indicators/metric-keys', () => {
    it('returns the closed catalog as a bare array, with hasDefinition reflecting real state', async () => {
      const { agent } = await agentWithPermissions(['indicator:view']);
      const response = await agent.get('/api/v1/indicators/metric-keys').set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as readonly IndicatorMetricCatalogEntryBody[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(11);

      const controlEntry = body.find((entry) => entry.metricKey === 'CONTROL_INACTIVE_COUNT');
      expect(controlEntry).toMatchObject({
        defaultLabel: 'Controles inativos',
        sourcePermission: 'control:view',
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        shape: 'SINGLE_VALUE',
        hasDefinition: true,
      });

      const neverConfiguredEntry = body.find((entry) => entry.metricKey === 'ACTION_OVERDUE_COUNT');
      expect(neverConfiguredEntry?.hasDefinition).toBe(false);
    });

    it('refuses a caller lacking indicator:view — 403', async () => {
      const { agent } = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/indicators/metric-keys').set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/indicators/metric-keys')
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });
  });
});
