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
import { createLocalUserFixture, createOrgUnitFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ProblemBody {
  readonly status: number;
}

interface DashboardSummaryMetricBody {
  readonly metricKey: string;
  readonly shape: 'SINGLE_VALUE' | 'BY_BUCKET';
  readonly scopeApplicability: 'ORGANIZATIONAL_UNIT' | 'ORGANIZATION_WIDE';
  readonly value?: number;
  readonly valueByBucket?: Record<string, number>;
}

interface DashboardSummaryBody {
  readonly metrics: readonly DashboardSummaryMetricBody[];
  readonly breakdowns: Readonly<Record<string, Record<string, unknown>>>;
}

describe('GET /dashboard/summary — the cross-domain GRC dashboard summary (getDashboardSummary)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
  ): Promise<{ agent: ReturnType<typeof request.agent>; orgUnitId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const unit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('dashboard-summary-org'),
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('dashboard-summary-actor')}@example.test`,
      primaryOrgUnitId: unit.id,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-dashboard-summary-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: unit.id });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, orgUnitId: unit.id };
  }

  it('refuses an unauthenticated caller with 401', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/v1/dashboard/summary');
    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(401);
  });

  it('succeeds (200, never 403) for a caller holding NONE of the eleven source permissions, with metrics: []', async () => {
    const { agent } = await agentWithPermissions([]);

    const response = await agent.get('/api/v1/dashboard/summary').set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as DashboardSummaryBody;
    expect(body.metrics).toEqual([]);
  });

  it('returns the declared shape for a caller holding risk:view and control:view: RISK_TOTAL_BY_LEVEL (BY_BUCKET) and CONTROL_INACTIVE_COUNT (SINGLE_VALUE) both present', async () => {
    const { agent, orgUnitId } = await agentWithPermissions(['risk:view', 'control:view']);
    const prisma = ctx.app.get(PrismaService);
    await prisma.client.control.create({
      data: {
        code: uniqueTestMarker('dbs-shape-ctl'),
        name: 'Controle do teste de contrato do resumo do dashboard',
        orgUnitId,
        status: 'DRAFT',
      },
    });

    const response = await agent.get('/api/v1/dashboard/summary').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as DashboardSummaryBody;

    const byKey = new Map(body.metrics.map((metric) => [metric.metricKey, metric]));

    const riskItem = byKey.get('RISK_TOTAL_BY_LEVEL');
    expect(riskItem).toBeDefined();
    expect(riskItem!.shape).toBe('BY_BUCKET');
    expect(riskItem!.scopeApplicability).toBe('ORGANIZATIONAL_UNIT');
    expect(riskItem!.valueByBucket).toBeDefined();
    expect(riskItem!.value).toBeUndefined();

    const controlItem = byKey.get('CONTROL_INACTIVE_COUNT');
    expect(controlItem).toBeDefined();
    expect(controlItem!.shape).toBe('SINGLE_VALUE');
    expect(typeof controlItem!.value).toBe('number');
    expect(controlItem!.value).toBeGreaterThanOrEqual(1);
    expect(controlItem!.valueByBucket).toBeUndefined();
  });

  it('OMITS CONTROL_INACTIVE_COUNT for a caller lacking control:view, while RISK_TOTAL_BY_LEVEL (granted) is still present', async () => {
    const { agent } = await agentWithPermissions(['risk:view']);

    const response = await agent.get('/api/v1/dashboard/summary').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as DashboardSummaryBody;

    const keys = body.metrics.map((metric) => metric.metricKey);
    expect(keys).toContain('RISK_TOTAL_BY_LEVEL');
    expect(keys).not.toContain('CONTROL_INACTIVE_COUNT');
  });

  it('the SAME key (CONTROL_INACTIVE_COUNT) IS present once the caller is granted control:view — proving "omitted by permission" is distinguishable from "omitted by lack of data"', async () => {
    const { agent } = await agentWithPermissions(['control:view']);

    const response = await agent.get('/api/v1/dashboard/summary').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as DashboardSummaryBody;

    const controlItem = body.metrics.find(
      (metric) => metric.metricKey === 'CONTROL_INACTIVE_COUNT',
    );
    expect(controlItem).toBeDefined();
    expect(typeof controlItem!.value).toBe('number');
  });

  it('always sends breakdowns, as an empty object for a caller holding none of the six block permissions', async () => {
    const { agent } = await agentWithPermissions([]);

    const response = await agent.get('/api/v1/dashboard/summary').set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as DashboardSummaryBody;
    expect(body.breakdowns).toEqual({});
  });

  it('omits a block without its permission and sends it, zero-filled for every status, with it', async () => {
    const { agent: without } = await agentWithPermissions(['risk:view']);
    const { agent: withIt } = await agentWithPermissions(['incident:view']);

    const withoutBody = (await without.get('/api/v1/dashboard/summary').set('Origin', appOrigin))
      .body as DashboardSummaryBody;
    const withBody = (await withIt.get('/api/v1/dashboard/summary').set('Origin', appOrigin))
      .body as DashboardSummaryBody;

    expect(withoutBody.breakdowns).not.toHaveProperty('incidents');
    expect(Object.keys(withBody.breakdowns)).toEqual(['incidents']);
    const incidentsByStatus = withBody.breakdowns.incidents?.byStatus as Record<string, unknown>;
    expect(Object.keys(incidentsByStatus).sort()).toEqual(
      ['CANCELLED', 'CLOSED', 'IN_PROGRESS', 'OPEN', 'RESOLVED'].sort(),
    );
    for (const count of Object.values(incidentsByStatus)) {
      expect(typeof count).toBe('number');
    }
  });

  it('returns the declared shape of every block for a caller holding all six block permissions', async () => {
    const { agent } = await agentWithPermissions([
      'action:view',
      'incident:view',
      'problem:view',
      'control:view',
      'compliance:view',
      'indicator:view',
    ]);

    const response = await agent.get('/api/v1/dashboard/summary').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const { breakdowns } = response.body as DashboardSummaryBody;

    expect(Object.keys(breakdowns).sort()).toEqual(
      ['actions', 'compliance', 'controls', 'incidents', 'indicators', 'problems'].sort(),
    );
    expect(Object.keys(breakdowns.actions?.byStatus as object).sort()).toEqual(
      ['CANCELLED', 'COMPLETED', 'IN_PROGRESS', 'OPEN'].sort(),
    );
    expect(typeof breakdowns.actions?.dueSoon).toBe('number');
    expect(breakdowns.actions?.dueSoonWindowDays).toBe(7);
    expect(Object.keys(breakdowns.problems?.byStatus as object).sort()).toEqual(
      ['CANCELLED', 'CLOSED', 'IN_ANALYSIS', 'OPEN', 'RESOLVED'].sort(),
    );
    expect(Object.keys(breakdowns.controls as object).sort()).toEqual(
      ['active', 'ineffective', 'total'].sort(),
    );
    const compliance = breakdowns.compliance as {
      requirementCount: number;
      byState: Record<string, number>;
    };
    expect(Object.keys(compliance.byState).sort()).toEqual(
      ['COMPLIANT', 'NOT_APPLICABLE', 'NOT_MET', 'NOT_PROVEN', 'PARTIALLY_MET'].sort(),
    );
    expect(Object.values(compliance.byState).reduce((sum, count) => sum + count, 0)).toBe(
      compliance.requirementCount,
    );
    expect(Object.keys(breakdowns.indicators as object).sort()).toEqual(['breached', 'monitored']);
  });

  it('never leaks a stack trace, internal path, SQL fragment or secret-shaped value in the response body', async () => {
    const { agent } = await agentWithPermissions([
      'risk:view',
      'control:view',
      'compliance:view',
      'audit-engagement:view',
      'finding:view',
      'asset:view',
      'process:view',
      'action:view',
      'incident:view',
      'problem:view',
    ]);

    const response = await agent.get('/api/v1/dashboard/summary').set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/at [\w.]+ \(.*:\d+:\d+\)/);
    expect(raw.toLowerCase()).not.toContain('password');
    expect(raw.toLowerCase()).not.toContain('secret');
    expect(raw).not.toMatch(/[A-Za-z]:\\\\/);
  });
});
