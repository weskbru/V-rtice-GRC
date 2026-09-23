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
  createMethodologyVersionFixture,
  createOrgUnitFixture,
  createUserFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface RiskDetailBody {
  readonly id: string;
  readonly status: string;
  readonly title: string;
}

interface ApprovalBody {
  readonly id: string;
  readonly status: string;
}

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly detail: string;
}

interface RiskLifecycleStateBody {
  readonly status: string;
  readonly availableTransitions: readonly unknown[];
  readonly traversedStatuses: readonly string[];
}

describe('Risk immutability on CLOSED/ARCHIVED (T151, FR-084)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerUserId: string;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const marker = uniqueTestMarker('risk-immutability');
    const orgUnit = await createOrgUnitFixture(prisma, { code: `${marker}-org` });
    orgUnitId = orgUnit.id;
    const owner = await createUserFixture(prisma, { email: `${marker}-owner@example.test` });
    ownerUserId = owner.id;
    const ownerRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-${marker}-owner-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: owner, role: ownerRole });
    await grantUnitScopeFixture(prisma, { user: owner, orgUnitId });
    const category = await prisma.client.riskCategory.create({
      data: {
        id: randomUUID(),
        code: `${marker}-category`,
        name: 'Categoria de teste',
        description: 'Fixture category.',
        sortOrder: 1,
        isActive: true,
      },
    });
    categoryId = category.id;

    const methodologyAuthor = await createUserFixture(prisma, {
      email: `${marker}-methodology-author@example.test`,
    });
    await createMethodologyVersionFixture(prisma, methodologyAuthor.id);
  });

  afterAll(async () => {
    await ctx.app
      .get(PrismaService)
      .client.riskCategory.update({ where: { id: categoryId }, data: { isActive: false } });
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: Parameters<typeof createRoleWithPermissionsFixture>[1],
    marker: string,
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${randomUUID()}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-${marker}-role-${randomUUID()}`,
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

  async function driveRiskToClosed(marker: string): Promise<{ riskId: string; etag: string }> {
    const requester = await agentWithPermissions(
      [
        'risk:create',
        'risk:view',
        'risk:edit',
        'risk:assess',
        'risk:transition',
        'risk:administer',
      ],
      `${marker}-requester`,
    );
    const approver = await agentWithPermissions(
      ['risk:view', 'risk:approve'],
      `${marker}-approver`,
    );

    const created = await requester.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco a ser encerrado',
      description: 'Descrição completa do risco.',
      categoryId,
      orgUnitId,
      ownerUserId,
    });
    expect(created.status).toBe(201);
    const risk = created.body as RiskDetailBody;
    let etag = created.headers.etag!;

    const assessed = await requester
      .post(`/api/v1/risks/${risk.id}/assessments`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({
        inherentProbability: 4,
        inherentImpact: 4,
        residualProbability: 2,
        residualImpact: 2,
        rationale: 'Avaliação inicial.',
      });
    expect(assessed.status).toBe(201);
    etag = assessed.headers.etag!;

    const toIdentified = await requester
      .post(`/api/v1/risks/${risk.id}/transitions`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ toStatus: 'IDENTIFIED' });
    expect(toIdentified.status).toBe(200);
    etag = toIdentified.headers.etag!;

    const toAssessed = await requester
      .post(`/api/v1/risks/${risk.id}/transitions`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ toStatus: 'ASSESSED' });
    expect(toAssessed.status).toBe(200);
    etag = toAssessed.headers.etag!;

    const acceptRequest = await requester
      .post(`/api/v1/risks/${risk.id}/approvals`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ toStatus: 'ACCEPTED' });
    expect(acceptRequest.status).toBe(201);
    const acceptApproval = acceptRequest.body as ApprovalBody;
    etag = acceptRequest.headers.etag!;

    const accepted = await approver
      .post(`/api/v1/risks/${risk.id}/approvals/${acceptApproval.id}/decision`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ decision: 'APPROVED' });
    expect(accepted.status).toBe(200);
    etag = accepted.headers.etag!;

    const closeRequest = await requester
      .post(`/api/v1/risks/${risk.id}/approvals`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ toStatus: 'CLOSED' });
    expect(closeRequest.status).toBe(201);
    const closeApproval = closeRequest.body as ApprovalBody;
    etag = closeRequest.headers.etag!;

    const closed = await approver
      .post(`/api/v1/risks/${risk.id}/approvals/${closeApproval.id}/decision`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ decision: 'APPROVED' });
    expect(closed.status).toBe(200);

    const closedBody = closed.body as ApprovalBody;
    expect(closedBody.status).toBe('APPROVED');

    const getClosed = await requester.get(`/api/v1/risks/${risk.id}`).set('Origin', appOrigin);
    expect(getClosed.status).toBe(200);
    expect((getClosed.body as RiskDetailBody).status).toBe('CLOSED');

    return { riskId: risk.id, etag: getClosed.headers.etag! };
  }

  it('a CLOSED risk refuses a business-content PATCH with 422 while remaining readable', async () => {
    const marker = uniqueTestMarker('risk-immutability-closed');
    const { riskId, etag } = await driveRiskToClosed(marker);

    const editor = await agentWithPermissions(['risk:view', 'risk:edit'], `${marker}-editor`);

    const patchAttempt = await editor
      .patch(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ title: 'Tentativa de editar risco encerrado' });

    expect(patchAttempt.status).toBe(422);
    const problem = patchAttempt.body as ProblemBody;
    expect(problem.status).toBe(422);

    const getAfter = await editor.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect(getAfter.status).toBe(200);
    const body = getAfter.body as RiskDetailBody;
    expect(body.status).toBe('CLOSED');
    expect(body.title).toBe('Risco a ser encerrado');
  });

  it('a CLOSED risk refuses PUT /risks/{riskId}/causes with 422 while remaining readable', async () => {
    const marker = uniqueTestMarker('risk-immutability-closed-causes');
    const { riskId, etag } = await driveRiskToClosed(marker);

    const editor = await agentWithPermissions(['risk:view', 'risk:edit'], `${marker}-editor`);

    const putAttempt = await editor
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ items: ['Tentativa de editar causas de risco encerrado'] });

    expect(putAttempt.status).toBe(422);
    const problem = putAttempt.body as ProblemBody;
    expect(problem.status).toBe(422);

    const getAfter = await editor.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect(getAfter.status).toBe(200);
    expect((getAfter.body as RiskDetailBody).status).toBe('CLOSED');
  });

  it('an ARCHIVED risk refuses a business-content PATCH with 422 while remaining readable', async () => {
    const marker = uniqueTestMarker('risk-immutability-archived');
    const { riskId, etag } = await driveRiskToClosed(marker);

    const archiver = await agentWithPermissions(
      ['risk:view', 'risk:edit', 'risk:administer'],
      `${marker}-archiver`,
    );

    const toArchived = await archiver
      .post(`/api/v1/risks/${riskId}/transitions`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ toStatus: 'ARCHIVED' });
    expect(toArchived.status).toBe(200);

    const patchAttempt = await archiver
      .patch(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', toArchived.headers.etag!)
      .send({ title: 'Tentativa de editar risco arquivado' });

    expect(patchAttempt.status).toBe(422);
    const problem = patchAttempt.body as ProblemBody;
    expect(problem.status).toBe(422);

    const getAfter = await archiver.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect(getAfter.status).toBe(200);
    const body = getAfter.body as RiskDetailBody;
    expect(body.status).toBe('ARCHIVED');
    expect(body.title).toBe('Risco a ser encerrado');
  });

  it('an ARCHIVED risk still shows every status it actually passed through as traversed (F-CV-3)', async () => {
    const marker = uniqueTestMarker('risk-immutability-traversed');
    const { riskId, etag } = await driveRiskToClosed(marker);

    const archiver = await agentWithPermissions(
      ['risk:view', 'risk:edit', 'risk:administer'],
      `${marker}-archiver`,
    );

    const toArchived = await archiver
      .post(`/api/v1/risks/${riskId}/transitions`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ toStatus: 'ARCHIVED' });
    expect(toArchived.status).toBe(200);

    const lifecycle = await archiver
      .get(`/api/v1/risks/${riskId}/lifecycle`)
      .set('Origin', appOrigin);
    expect(lifecycle.status).toBe(200);
    const lifecycleBody = lifecycle.body as RiskLifecycleStateBody;

    expect(lifecycleBody.status).toBe('ARCHIVED');
    expect(lifecycleBody.availableTransitions).toHaveLength(0);
    expect(lifecycleBody.traversedStatuses).toEqual([
      'DRAFT',
      'IDENTIFIED',
      'ASSESSED',
      'ACCEPTED',
      'CLOSED',
      'ARCHIVED',
    ]);
    expect(lifecycleBody.traversedStatuses).not.toContain('UNDER_TREATMENT');
    expect(lifecycleBody.traversedStatuses).not.toContain('UNDER_REVIEW');
  });

  it('an ARCHIVED risk refuses PUT /risks/{riskId}/consequences with 422 while remaining readable', async () => {
    const marker = uniqueTestMarker('risk-immutability-archived-consequences');
    const { riskId, etag } = await driveRiskToClosed(marker);

    const archiver = await agentWithPermissions(
      ['risk:view', 'risk:edit', 'risk:administer'],
      `${marker}-archiver`,
    );

    const toArchived = await archiver
      .post(`/api/v1/risks/${riskId}/transitions`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({ toStatus: 'ARCHIVED' });
    expect(toArchived.status).toBe(200);

    const putAttempt = await archiver
      .put(`/api/v1/risks/${riskId}/consequences`)
      .set('Origin', appOrigin)
      .set('If-Match', toArchived.headers.etag!)
      .send({ items: ['Tentativa de editar consequências de risco arquivado'] });

    expect(putAttempt.status).toBe(422);
    const problem = putAttempt.body as ProblemBody;
    expect(problem.status).toBe(422);

    const getAfter = await archiver.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect(getAfter.status).toBe(200);
    expect((getAfter.body as RiskDetailBody).status).toBe('ARCHIVED');
  });
});
