import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
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

interface RiskDetailBody {
  readonly id: string;
  readonly currentTreatment: {
    readonly id: string;
    readonly strategy: string;
    readonly description: string;
    readonly deadline: string | null;
    readonly decidedBy: { readonly id: string };
    readonly decidedAt: string;
    readonly supersededAt: string | null;
    readonly deadlineOverdue: boolean;
  } | null;
  readonly controls: readonly { readonly control: { readonly id: string } }[];
  readonly processes: readonly { readonly entity: { readonly id: string } }[];
  readonly assets: readonly { readonly entity: { readonly id: string } }[];
  readonly treatmentActionSummary: {
    readonly total: number;
    readonly open: number;
    readonly overdue: number;
  };
  readonly overdueTreatment: boolean;
  readonly pendingApprovalDetail: unknown;
}

describe('GET /risks/{riskId} — currentTreatment/controls/processes/assets/treatmentActionSummary (US5 backend gap)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-detail-contract-org'),
    });
    orgUnitId = orgUnit.id;
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-detail-contract-owner')}@example.test`,
    });
    ownerUserId = owner.id;
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: Parameters<typeof createRoleWithPermissionsFixture>[1],
  ): Promise<{ agent: ReturnType<typeof request.agent> }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-detail-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-risk-detail-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent };
  }

  async function createRisk(
    agent: ReturnType<typeof request.agent>,
  ): Promise<{ id: string; version: string }> {
    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para teste de detalhe',
      description: 'Descrição do risco.',
      orgUnitId,
      ownerUserId,
    });
    expect(response.status).toBe(201);
    const body = response.body as RiskDetailBody;
    return { id: body.id, version: response.headers.etag! };
  }

  it('a risk never treated/linked returns the documented empty shape — not null/omitted, and not an error', async () => {
    const { agent } = await agentWithPermissions(['risk:create', 'risk:view']);
    const { id } = await createRisk(agent);

    const response = await agent.get(`/api/v1/risks/${id}`).set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as RiskDetailBody;
    expect(body.currentTreatment).toBeNull();
    expect(body.controls).toEqual([]);
    expect(body.processes).toEqual([]);
    expect(body.assets).toEqual([]);
    expect(body.treatmentActionSummary).toEqual({ total: 0, open: 0, overdue: 0 });
    expect(body.overdueTreatment).toBe(false);
    expect(body.pendingApprovalDetail).toBeNull();
  });

  it('a risk with a treatment decision, actions and links returns them populated, with overdueTreatment/summary consistent with the register rule', async () => {
    const { agent } = await agentWithPermissions([
      'risk:create',
      'risk:view',
      'risk:treat',
      'risk:edit',
      'control:view',
      'process:view',
      'asset:view',
    ]);
    const { id, version } = await createRisk(agent);

    const treatment = await agent
      .post(`/api/v1/risks/${id}/treatments`)
      .set('Origin', appOrigin)
      .set('If-Match', version)
      .send({
        strategy: 'MITIGATE',
        description: 'Mitigar via controles adicionais.',
        deadline: '2027-06-30',
      });
    expect(treatment.status).toBe(201);
    const decisionId = (treatment.body as { id: string }).id;

    const overdueAction = await agent
      .post(`/api/v1/risks/${id}/treatment-actions`)
      .set('Origin', appOrigin)
      .set('If-Match', treatment.headers.etag!)
      .send({
        title: 'Ação vencida',
        responsibleUserId: ownerUserId,
        dueOn: '2020-01-01',
        treatmentDecisionId: decisionId,
      });
    expect(overdueAction.status).toBe(201);

    const futureAction = await agent
      .post(`/api/v1/risks/${id}/treatment-actions`)
      .set('Origin', appOrigin)
      .set('If-Match', overdueAction.headers.etag!)
      .send({ title: 'Ação futura', responsibleUserId: ownerUserId, dueOn: '2099-01-01' });
    expect(futureAction.status).toBe(201);

    const control = await ctx.app.get(PrismaService).client.control.create({
      data: {
        code: uniqueTestMarker('risk-detail-control'),
        name: 'Controle',
        orgUnitId,
        isActive: true,
      },
    });
    const controlLink = await agent
      .post(`/api/v1/risks/${id}/controls`)
      .set('Origin', appOrigin)
      .set('If-Match', futureAction.headers.etag!)
      .send({ id: control.id });
    expect(controlLink.status).toBe(201);

    const process = await ctx.app.get(PrismaService).client.process.create({
      data: {
        code: uniqueTestMarker('risk-detail-process'),
        name: 'Processo',
        orgUnitId,
        isActive: true,
      },
    });
    const processLink = await agent
      .post(`/api/v1/risks/${id}/processes`)
      .set('Origin', appOrigin)
      .set('If-Match', controlLink.headers.etag!)
      .send({ id: process.id });
    expect(processLink.status).toBe(201);

    const asset = await ctx.app.get(PrismaService).client.asset.create({
      data: {
        code: uniqueTestMarker('risk-detail-asset'),
        name: 'Ativo',
        orgUnitId,
        isActive: true,
      },
    });
    const assetLink = await agent
      .post(`/api/v1/risks/${id}/assets`)
      .set('Origin', appOrigin)
      .set('If-Match', processLink.headers.etag!)
      .send({ id: asset.id });
    expect(assetLink.status).toBe(201);

    const response = await agent.get(`/api/v1/risks/${id}`).set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as RiskDetailBody;

    expect(body.currentTreatment).not.toBeNull();
    expect(body.currentTreatment!.id).toBe(decisionId);
    expect(body.currentTreatment!.strategy).toBe('MITIGATE');
    expect(body.currentTreatment!.supersededAt).toBeNull();
    expect(body.currentTreatment!.deadlineOverdue).toBe(false);

    expect(body.controls).toHaveLength(1);
    expect(body.controls[0]!.control.id).toBe(control.id);
    expect(body.processes).toHaveLength(1);
    expect(body.processes[0]!.entity.id).toBe(process.id);
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0]!.entity.id).toBe(asset.id);

    expect(body.treatmentActionSummary).toEqual({ total: 2, open: 2, overdue: 1 });
    expect(body.overdueTreatment).toBe(true);
  });

  it('an unlinked/superseded history is NOT surfaced as current — GET reflects only the active state', async () => {
    const { agent } = await agentWithPermissions([
      'risk:create',
      'risk:view',
      'risk:treat',
      'risk:edit',
      'control:view',
    ]);
    const { id, version } = await createRisk(agent);

    const first = await agent
      .post(`/api/v1/risks/${id}/treatments`)
      .set('Origin', appOrigin)
      .set('If-Match', version)
      .send({ strategy: 'ACCEPT', description: 'Primeira decisão.' });
    expect(first.status).toBe(201);

    const second = await agent
      .post(`/api/v1/risks/${id}/treatments`)
      .set('Origin', appOrigin)
      .set('If-Match', first.headers.etag!)
      .send({ strategy: 'MITIGATE', description: 'Decisão vigente.' });
    expect(second.status).toBe(201);

    const control = await ctx.app.get(PrismaService).client.control.create({
      data: {
        code: uniqueTestMarker('risk-detail-unlink-control'),
        name: 'Controle',
        orgUnitId,
        isActive: true,
      },
    });
    const link = await agent
      .post(`/api/v1/risks/${id}/controls`)
      .set('Origin', appOrigin)
      .set('If-Match', second.headers.etag!)
      .send({ id: control.id });
    expect(link.status).toBe(201);
    const linkId = (link.body as { id: string }).id;

    const unlink = await agent
      .delete(`/api/v1/risks/${id}/controls/${linkId}`)
      .set('Origin', appOrigin)
      .set('If-Match', link.headers.etag!);
    expect(unlink.status).toBe(204);

    const response = await agent.get(`/api/v1/risks/${id}`).set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as RiskDetailBody;

    expect(body.currentTreatment!.strategy).toBe('MITIGATE');
    expect(body.currentTreatment!.description).toBe('Decisão vigente.');
    expect(body.controls).toEqual([]);
  });

  it('T039: a risk-asset/risk-process link between units, created BEFORE the scope check existed, stays fully readable', async () => {
    const { agent } = await agentWithPermissions(['risk:create', 'risk:view']);
    const { id: riskId } = await createRisk(agent);

    const prisma = ctx.app.get(PrismaService);
    const otherUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-detail-t039-other-unit'),
    });
    const legacyProcess = await prisma.client.process.create({
      data: {
        code: uniqueTestMarker('risk-detail-t039-process'),
        name: 'Processo legado entre unidades',
        orgUnitId: otherUnit.id,
        isActive: true,
      },
    });
    const legacyAsset = await prisma.client.asset.create({
      data: {
        code: uniqueTestMarker('risk-detail-t039-asset'),
        name: 'Ativo legado entre unidades',
        orgUnitId: otherUnit.id,
        isActive: true,
      },
    });

    await prisma.client.riskProcessLink.create({
      data: {
        riskId,
        processId: legacyProcess.id,
        linkedByUserId: ownerUserId,
        linkedAt: new Date(),
      },
    });
    await prisma.client.riskAssetLink.create({
      data: {
        riskId,
        assetId: legacyAsset.id,
        linkedByUserId: ownerUserId,
        linkedAt: new Date(),
      },
    });

    const response = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as RiskDetailBody;

    expect(body.processes).toHaveLength(1);
    expect(body.processes[0]!.entity.id).toBe(legacyProcess.id);
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0]!.entity.id).toBe(legacyAsset.id);
  });
});
