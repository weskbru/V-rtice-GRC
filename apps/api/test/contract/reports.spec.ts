/**
 * 009-indicators-reports, Fase 7 (T047-T050) + Fase 8 (T068) — coverage for
 * US5's four operations: `GET /reports` (`listReportDefinitions`),
 * `POST /reports` (`createReportDefinition`), and
 * `GET /reports/{reportId}/run` in both its JSON (default) and `text/csv`
 * (`format=csv`) forms (`runReport`) — plus, added by T068, the contract's
 * two remaining operations: `GET /reports/{reportId}` (`getReportDefinition`)
 * and `PATCH /reports/{reportId}` (`updateReportDefinition`).
 *
 * Every JSON response here is additionally checked against
 * `contracts/reports.openapi.yaml` by the module-level payload validator
 * (`installResponseValidation`, `openapi-documents.ts`'s `Reports` entry)
 * — no test in this file needs to hand-assert every field the schema
 * already requires. The `text/csv` response is never JSON and is never
 * routed through that validator (`auto-validate-responses.ts`'s own
 * `isJsonContentType` check) — this file asserts its shape directly
 * instead.
 *
 * `ReportDefinition` has NO uniqueness constraint on `metricKeys` (unlike
 * `IndicatorDefinition.metricKey UNIQUE`) — every `it()` below is free to
 * reference any `IndicatorMetricKey`, any number of times, without
 * colliding with another `it()` in this file.
 */
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
import { createLocalUserFixture, createOrgUnitFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ProblemBody {
  readonly status: number;
  readonly title?: string;
  readonly detail?: string;
  readonly type?: string;
}

interface ReportDefinitionBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly metricKeys: readonly string[];
  readonly isActive: boolean;
  readonly createdBy: { readonly id: string; readonly fullName: string };
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ReportDefinitionPageBody {
  readonly data: readonly ReportDefinitionBody[];
  readonly meta: { readonly page: number; readonly pageSize: number; readonly total: number };
}

interface ReportRunItemBody {
  readonly metricKey: string;
  readonly label: string;
  readonly available: boolean;
  readonly scopeApplicability: 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';
  readonly value?: number;
  readonly valueByBucket?: Record<string, number>;
}

interface ReportRunResultBody {
  readonly reportId: string;
  readonly computedAt: string;
  readonly items: readonly ReportRunItemBody[];
}

describe('Report contract (US5, 009-indicators-reports)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('report-contract-org'),
    });
    orgUnitId = orgUnit.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('report-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: uniqueTestMarker('fixture-report-role'),
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

  function validCreateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: 'Relatório de teste',
      description: 'Descrição do relatório de teste do contrato.',
      metricKeys: ['CONTROL_INACTIVE_COUNT'],
      ...overrides,
    };
  }

  // -------------------------------------------------------------------
  // createReportDefinition (T048)
  // -------------------------------------------------------------------

  describe('POST /reports', () => {
    it('succeeds for a caller holding report:create and returns the declared shape', async () => {
      const { agent, userId } = await agentWithPermissions(['report:create', 'report:view']);
      const response = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(
          validCreateBody({
            metricKeys: ['CONTROL_INACTIVE_COUNT', 'ASSET_INACTIVE_COUNT'],
          }),
        );

      expect(response.status).toBe(201);
      const body = response.body as ReportDefinitionBody;
      expect(body.id).toBeTruthy();
      expect(body.code).toMatch(/^RPT-\d{4}-\d{4,}$/);
      expect(body.name).toBe('Relatório de teste');
      expect(body.metricKeys).toEqual(['CONTROL_INACTIVE_COUNT', 'ASSET_INACTIVE_COUNT']);
      expect(body.isActive).toBe(true);
      expect(body.createdBy.id).toBe(userId);
    });

    it('rejects an empty metricKeys array — 400 (schema validation, not a domain error)', async () => {
      const { agent } = await agentWithPermissions(['report:create', 'report:view']);
      const response = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKeys: [] }));
      expect(response.status).toBe(400);
    });

    it('rejects an unknown metricKey value — 400, not 422 (contracts/reports.openapi.yaml own decision)', async () => {
      const { agent } = await agentWithPermissions(['report:create', 'report:view']);
      const response = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKeys: ['NOT_A_REAL_METRIC_KEY'] }));
      expect(response.status).toBe(400);
    });

    it('rejects a duplicate metricKey in the same array — 400', async () => {
      const { agent } = await agentWithPermissions(['report:create', 'report:view']);
      const response = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(
          validCreateBody({
            metricKeys: ['CONTROL_INACTIVE_COUNT', 'CONTROL_INACTIVE_COUNT'],
          }),
        );
      expect(response.status).toBe(400);
    });

    it('refuses a caller lacking report:create — 403', async () => {
      const { agent } = await agentWithPermissions(['report:view']);
      const response = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(validCreateBody());
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(validCreateBody());
      expect(response.status).toBe(401);
      expect((response.body as ProblemBody).status).toBe(401);
    });

    it('emits a distinct report.created audit event on success', async () => {
      const { agent } = await agentWithPermissions(['report:create', 'report:view']);
      const response = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(validCreateBody());
      expect(response.status).toBe(201);
      const body = response.body as ReportDefinitionBody;

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: body.id, action: 'report.created' },
      });
      expect(auditRow).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // listReportDefinitions (T047)
  // -------------------------------------------------------------------

  describe('GET /reports', () => {
    it('responds with the {data, meta} envelope, never {items}', async () => {
      const { agent } = await agentWithPermissions(['report:create', 'report:view']);
      const createResponse = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(validCreateBody({ name: 'Relatório para listagem' }));
      const createdId = (createResponse.body as ReportDefinitionBody).id;

      const response = await agent.get('/api/v1/reports').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as ReportDefinitionPageBody;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toMatchObject({ page: 1, pageSize: 20 });
      expect((body as unknown as { items?: unknown }).items).toBeUndefined();
      expect(body.data.some((item) => item.id === createdId)).toBe(true);
    });

    it('refuses a caller lacking report:view — 403', async () => {
      const { agent } = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/reports').set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/reports')
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // runReport, JSON form (T049)
  // -------------------------------------------------------------------

  describe('GET /reports/{reportId}/run (JSON)', () => {
    it('computes every referenced metric under the caller scope and returns the declared shape', async () => {
      const { agent } = await agentWithPermissions([
        'report:create',
        'report:view',
        'control:view',
      ]);
      const createResponse = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(validCreateBody({ metricKeys: ['CONTROL_INACTIVE_COUNT'] }));
      const reportId = (createResponse.body as ReportDefinitionBody).id;

      const response = await agent.get(`/api/v1/reports/${reportId}/run`).set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as ReportRunResultBody;
      expect(body.reportId).toBe(reportId);
      expect(body.computedAt).toBeTruthy();
      expect(body.items).toHaveLength(1);
      expect(body.items[0]!.metricKey).toBe('CONTROL_INACTIVE_COUNT');
      expect(body.items[0]!.available).toBe(true);
      expect(body.items[0]!.scopeApplicability).toBe('ORGANIZATIONAL_UNIT');
      expect(typeof body.items[0]!.value).toBe('number');
      expect(body.items[0]!.valueByBucket).toBeUndefined();
    });

    it('SC-006 — a caller missing one metric source permission gets that item available:false, the others computed, and 200 overall', async () => {
      const { agent } = await agentWithPermissions([
        'report:create',
        'report:view',
        'risk:view',
        'asset:view',
        // Deliberately NOT `control:view`.
      ]);
      const createResponse = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(
          validCreateBody({
            name: 'Relatório multi-domínio (SC-006)',
            metricKeys: ['RISK_TOTAL_BY_LEVEL', 'ASSET_INACTIVE_COUNT', 'CONTROL_INACTIVE_COUNT'],
          }),
        );
      expect(createResponse.status).toBe(201);
      const reportId = (createResponse.body as ReportDefinitionBody).id;

      const response = await agent.get(`/api/v1/reports/${reportId}/run`).set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as ReportRunResultBody;
      expect(body.items).toHaveLength(3);

      const byKey = new Map(body.items.map((item) => [item.metricKey, item]));

      const riskItem = byKey.get('RISK_TOTAL_BY_LEVEL')!;
      expect(riskItem.available).toBe(true);
      expect(riskItem.valueByBucket).toBeDefined();
      expect(riskItem.value).toBeUndefined();

      const assetItem = byKey.get('ASSET_INACTIVE_COUNT')!;
      expect(assetItem.available).toBe(true);
      expect(typeof assetItem.value).toBe('number');

      const controlItem = byKey.get('CONTROL_INACTIVE_COUNT')!;
      expect(controlItem.available).toBe(false);
      expect(controlItem.value).toBeUndefined();
      expect(controlItem.valueByBucket).toBeUndefined();
    });

    it('refuses a caller lacking report:view — 403', async () => {
      const { agent: creator } = await agentWithPermissions([
        'report:create',
        'report:view',
        'control:view',
      ]);
      const createResponse = await creator
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(validCreateBody());
      const reportId = (createResponse.body as ReportDefinitionBody).id;

      const { agent: unauthorized } = await agentWithPermissions([]);
      const response = await unauthorized
        .get(`/api/v1/reports/${reportId}/run`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('an unknown reportId is 404', async () => {
      const { agent } = await agentWithPermissions(['report:view']);
      const response = await agent
        .get('/api/v1/reports/00000000-0000-0000-0000-000000000000/run')
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/reports/00000000-0000-0000-0000-000000000000/run')
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // runReport, text/csv form (T050)
  // -------------------------------------------------------------------

  describe('GET /reports/{reportId}/run?format=csv', () => {
    it('responds text/csv with a header row and one data row per referenced metric, in declared order', async () => {
      const { agent } = await agentWithPermissions([
        'report:create',
        'report:view',
        'control:view',
        'asset:view',
      ]);
      const createResponse = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(
          validCreateBody({
            name: 'Relatório CSV',
            metricKeys: ['CONTROL_INACTIVE_COUNT', 'ASSET_INACTIVE_COUNT'],
          }),
        );
      const reportId = (createResponse.body as ReportDefinitionBody).id;

      const response = await agent
        .get(`/api/v1/reports/${reportId}/run`)
        .query({ format: 'csv' })
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      const lines = response.text.trim().split('\r\n');
      expect(lines[0]).toBe('metricKey,label,available,value,scopeApplicability');
      expect(lines).toHaveLength(3);
      expect(lines[1]).toMatch(/^CONTROL_INACTIVE_COUNT,/);
      expect(lines[2]).toMatch(/^ASSET_INACTIVE_COUNT,/);
    });

    it('an item lacking source permission is an empty value column, never a zeroed number', async () => {
      const { agent } = await agentWithPermissions([
        'report:create',
        'report:view',
        'asset:view',
        // Deliberately NOT `control:view`.
      ]);
      const createResponse = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(
          validCreateBody({
            name: 'Relatório CSV com item indisponível',
            metricKeys: ['CONTROL_INACTIVE_COUNT'],
          }),
        );
      const reportId = (createResponse.body as ReportDefinitionBody).id;

      const response = await agent
        .get(`/api/v1/reports/${reportId}/run`)
        .query({ format: 'csv' })
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const lines = response.text.trim().split('\r\n');
      // header,available=false row: metricKey,label,false,,scopeApplicability
      expect(lines[1]).toMatch(/^CONTROL_INACTIVE_COUNT,.*,false,,ORGANIZATIONAL_UNIT$/);
    });

    it('an unknown reportId is 404 for the csv variant too', async () => {
      const { agent } = await agentWithPermissions(['report:view']);
      const response = await agent
        .get('/api/v1/reports/00000000-0000-0000-0000-000000000000/run')
        .query({ format: 'csv' })
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------
  // getReportDefinition (T068) — `ReportDefinition` has no uniqueness
  // constraint on `metricKeys` (this file's own header), so this describe
  // block is free to create its own fixture without any cross-`it()`
  // key-allocation concern.
  // -------------------------------------------------------------------

  describe('GET /reports/{reportId}', () => {
    let reportId: string;

    beforeAll(async () => {
      const { agent } = await agentWithPermissions(['report:create', 'report:view']);
      const response = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(validCreateBody({ name: 'Relatório para getReportDefinition' }));
      expect(response.status).toBe(201);
      reportId = (response.body as ReportDefinitionBody).id;
    });

    it('returns the declared shape for a caller holding report:view', async () => {
      const { agent } = await agentWithPermissions(['report:view']);
      const response = await agent.get(`/api/v1/reports/${reportId}`).set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as ReportDefinitionBody;
      expect(body.id).toBe(reportId);
      expect(body.name).toBe('Relatório para getReportDefinition');
    });

    it('an unknown reportId is 404', async () => {
      const { agent } = await agentWithPermissions(['report:view']);
      const response = await agent
        .get('/api/v1/reports/00000000-0000-0000-0000-000000000000')
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('refuses a caller lacking report:view — 403', async () => {
      const { agent } = await agentWithPermissions([]);
      const response = await agent.get(`/api/v1/reports/${reportId}`).set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/v1/reports/${reportId}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // updateReportDefinition (T068)
  // -------------------------------------------------------------------

  describe('PATCH /reports/{reportId}', () => {
    let reportId: string;

    beforeAll(async () => {
      const { agent } = await agentWithPermissions(['report:create', 'report:view']);
      const response = await agent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send(
          validCreateBody({
            name: 'Relatório para updateReportDefinition',
            metricKeys: ['CONTROL_INACTIVE_COUNT'],
          }),
        );
      expect(response.status).toBe(201);
      reportId = (response.body as ReportDefinitionBody).id;
    });

    it('edits name, description and metricKeys and returns the declared shape', async () => {
      const { agent } = await agentWithPermissions(['report:edit', 'report:view']);
      const response = await agent
        .patch(`/api/v1/reports/${reportId}`)
        .set('Origin', appOrigin)
        .send({
          name: 'Relatório editado',
          description: 'Nova descrição do relatório.',
          metricKeys: ['CONTROL_INACTIVE_COUNT', 'ASSET_INACTIVE_COUNT'],
        });

      expect(response.status).toBe(200);
      const body = response.body as ReportDefinitionBody;
      expect(body.id).toBe(reportId);
      expect(body.name).toBe('Relatório editado');
      expect(body.description).toBe('Nova descrição do relatório.');
      expect(body.metricKeys).toEqual(['CONTROL_INACTIVE_COUNT', 'ASSET_INACTIVE_COUNT']);
    });

    it('edits isActive', async () => {
      const { agent } = await agentWithPermissions(['report:edit', 'report:view']);
      const response = await agent
        .patch(`/api/v1/reports/${reportId}`)
        .set('Origin', appOrigin)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      const body = response.body as ReportDefinitionBody;
      expect(body.isActive).toBe(false);
    });

    it('rejects an empty metricKeys array on update — 400 (schema validation)', async () => {
      const { agent } = await agentWithPermissions(['report:edit']);
      const response = await agent
        .patch(`/api/v1/reports/${reportId}`)
        .set('Origin', appOrigin)
        .send({ metricKeys: [] });
      expect(response.status).toBe(400);
    });

    it('rejects an unknown metricKey value on update — 400', async () => {
      const { agent } = await agentWithPermissions(['report:edit']);
      const response = await agent
        .patch(`/api/v1/reports/${reportId}`)
        .set('Origin', appOrigin)
        .send({ metricKeys: ['NOT_A_REAL_METRIC_KEY'] });
      expect(response.status).toBe(400);
    });

    it('an unknown reportId is 404', async () => {
      const { agent } = await agentWithPermissions(['report:edit']);
      const response = await agent
        .patch('/api/v1/reports/00000000-0000-0000-0000-000000000000')
        .set('Origin', appOrigin)
        .send({ name: 'Não importa' });
      expect(response.status).toBe(404);
    });

    it('refuses a caller lacking report:edit — 403', async () => {
      const { agent } = await agentWithPermissions(['report:view']);
      const response = await agent
        .patch(`/api/v1/reports/${reportId}`)
        .set('Origin', appOrigin)
        .send({ name: 'Não importa' });
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .patch(`/api/v1/reports/${reportId}`)
        .set('Origin', appOrigin)
        .send({ name: 'Não importa' });
      expect(response.status).toBe(401);
    });
  });
});
