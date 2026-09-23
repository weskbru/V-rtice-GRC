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

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly type: string;
  readonly detail: string;
}

describe('Risk permission enforcement (T079, FR-030, ADR-003)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let existingRiskId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-permissions-org'),
    });
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('rp-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });

    const authorizedActor = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('rp-privileged')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const privilegedRole = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:create', 'risk:edit', 'risk:view'],
      { name: `fixture-risk-permissions-privileged-role-${randomUUID()}` },
    );
    await assignRoleFixture(prisma, { user: authorizedActor, role: privilegedRole });
    await grantUnitScopeFixture(prisma, { user: authorizedActor, orgUnitId: orgUnit.id });

    const createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    const risk = await createRiskUseCase.execute({
      actorUserId: authorizedActor.id,
      title: 'Risco existente para o teste de permissão',
      description: 'Descrição.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });
    existingRiskId = risk.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function loginAsUnprivilegedActor(): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('rp-unpriv-org'),
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('rp-unpriv')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const viewOnlyRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-rp-view-only-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role: viewOnlyRole });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return agent;
  }

  it('refuses POST /risks with 403 when the caller lacks risk:create', async () => {
    const agent = await loginAsUnprivilegedActor();

    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Tentativa não autorizada',
      description: 'Não deveria ser criado.',
      orgUnitId: randomUUID(),
      ownerUserId: randomUUID(),
    });

    expect(response.status).toBe(403);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(403);

    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
  });

  it('refuses PATCH /risks/{riskId} with 403 when the caller lacks risk:edit — identically for a real risk and a nonexistent one (FR-030)', async () => {
    const agent = await loginAsUnprivilegedActor();
    const nonexistentRiskId = randomUUID();

    const responseForExistingRisk = await agent
      .patch(`/api/v1/risks/${existingRiskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', '"0"')
      .send({ title: 'Tentativa não autorizada' });

    const responseForNonexistentRisk = await agent
      .patch(`/api/v1/risks/${nonexistentRiskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', '"0"')
      .send({ title: 'Tentativa não autorizada' });

    expect(responseForExistingRisk.status).toBe(403);
    expect(responseForNonexistentRisk.status).toBe(403);

    const existingBody = responseForExistingRisk.body as ProblemBody;
    const nonexistentBody = responseForNonexistentRisk.body as ProblemBody;

    expect(nonexistentBody.status).toBe(existingBody.status);
    expect(nonexistentBody.title).toBe(existingBody.title);
    expect(nonexistentBody.type).toBe(existingBody.type);
    expect(nonexistentBody.detail).toBe(existingBody.detail);
  });

  it('never discloses internal detail in either 403 body (FR-107)', async () => {
    const agent = await loginAsUnprivilegedActor();

    const response = await agent
      .patch(`/api/v1/risks/${existingRiskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', '"0"')
      .send({ title: 'x' });

    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
    expect(raw).not.toMatch(/passwordHash/i);
  });
});
