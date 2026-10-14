import { randomUUID } from 'node:crypto';

import { UserStatus, type User } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { formatETag } from '../../src/modules/risk/presentation/risk.controller';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
  grantUnitScopeFixture,
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
  readonly title: string;
  readonly description: string;
  readonly version: number;
  readonly orgUnit: { readonly id: string };
  readonly owner: { readonly id: string };
}

interface VersionConflictProblemBody {
  readonly status: number;
  readonly currentVersion: number;
  readonly currentStatus?: string;
}

interface ValidationProblemBody {
  readonly status: number;
  readonly detail: string;
  readonly errors: readonly { readonly field: string; readonly message: string }[];
}

describe('PATCH /risks/{riskId} — success path and optimistic locking (contracts/risks.openapi.yaml ~241, ADR-013)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerId: string;
  let actorUserId: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-update-org'),
    });
    orgUnitId = orgUnit.id;
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-update-owner')}@example.test`,
    });
    ownerId = owner.id;
    const ownerRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-risk-update-owner-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: owner, role: ownerRole });
    await grantUnitScopeFixture(prisma, { user: owner, orgUnitId: orgUnit.id });

    const actorFixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-update-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    actorUserId = actorFixture.user.id;
    const role = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:create', 'risk:edit', 'risk:view'],
      { name: `fixture-risk-update-role-${randomUUID()}` },
    );
    await assignRoleFixture(prisma, { user: actorFixture.user, role });
    await grantUnitScopeFixture(prisma, { user: actorFixture.user, orgUnitId: orgUnit.id });

    agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: actorFixture.user.email, password: actorFixture.rawPassword });
    expect(loginResponse.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function createRisk(): Promise<string> {
    const createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    const risk = await createRiskUseCase.execute({
      actorUserId,
      title: 'Risco original para teste de PATCH',
      description: 'Descrição original.',
      orgUnitId,
      ownerUserId: ownerId,
    });
    return risk.id;
  }

  it('succeeds (200) for a caller holding risk:edit and scope, using the real ETag from a prior GET, and returns the updated RiskDetail with an incremented ETag', async () => {
    const riskId = await createRisk();

    const getResponse = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect(getResponse.status).toBe(200);
    const initialETag = getResponse.headers.etag!;
    expect(initialETag).toBe(formatETag(0));

    const patchResponse = await agent
      .patch(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', initialETag)
      .send({ title: 'Risco atualizado via PATCH' });

    expect(patchResponse.status).toBe(200);
    const body = patchResponse.body as RiskDetailBody;
    expect(body.id).toBe(riskId);
    expect(body.title).toBe('Risco atualizado via PATCH');
    expect(body.description).toBe('Descrição original.');
    expect(body.orgUnit.id).toBe(orgUnitId);
    expect(body.owner.id).toBe(ownerId);

    expect(body.version).toBe(1);
    expect(patchResponse.headers.etag).toBe(formatETag(1));

    const reGetResponse = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect(reGetResponse.status).toBe(200);
    expect((reGetResponse.body as RiskDetailBody).title).toBe('Risco atualizado via PATCH');
    expect(reGetResponse.headers.etag).toBe(formatETag(1));
  });

  it('rejects a stale If-Match with 409, echoes the current version in the body and ETag header, and does NOT write the stale request (FR-103, ADR-013)', async () => {
    const riskId = await createRisk();

    const firstPatch = await agent
      .patch(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ title: 'Primeira atualização' });
    expect(firstPatch.status).toBe(200);
    expect(firstPatch.body).toMatchObject({ version: 1 });

    const staleTitle = 'Esta escrita não deveria ser aplicada';
    const stalePatch = await agent
      .patch(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ title: staleTitle });

    expect(stalePatch.status).toBe(409);
    expect(stalePatch.headers['content-type']).toContain('application/problem+json');
    const conflictBody = stalePatch.body as VersionConflictProblemBody;
    expect(conflictBody.status).toBe(409);
    expect(conflictBody.currentVersion).toBe(1);
    expect(stalePatch.headers.etag).toBe(formatETag(1));

    const getAfterConflict = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect(getAfterConflict.status).toBe(200);
    const afterBody = getAfterConflict.body as RiskDetailBody;
    expect(afterBody.title).toBe('Primeira atualização');
    expect(afterBody.title).not.toBe(staleTitle);
    expect(afterBody.version).toBe(1);
  });

  it('rejects a missing If-Match with 400 before any write is attempted', async () => {
    const riskId = await createRisk();

    const response = await agent
      .patch(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin)
      .send({ title: 'Sem If-Match' });

    expect(response.status).toBe(400);

    const getAfter = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect((getAfter.body as RiskDetailBody).title).toBe('Risco original para teste de PATCH');
  });
  it('rejects an empty PATCH body with 400, leaving the version and the record untouched (UpdateRiskRequest minProperties: 1)', async () => {
    const riskId = await createRisk();

    const getResponse = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    const initialETag = getResponse.headers.etag!;

    const response = await agent
      .patch(`/api/v1/risks/${riskId}`)
      .set('Origin', appOrigin)
      .set('If-Match', initialETag)
      .send({});

    expect(response.status).toBe(400);

    const getAfter = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect(getAfter.headers.etag).toBe(initialETag);
    expect((getAfter.body as RiskDetailBody).title).toBe('Risco original para teste de PATCH');
  });

  describe('Owner/responsible organizational assignment line enforcement (ADR-004)', () => {
    let unitAncestorId: string;
    let unitRiskId: string;
    let unitSiblingId: string;
    let creatorAgent: ReturnType<typeof request.agent>;

    async function makeVisibleToRisk(prisma: PrismaService, user: User): Promise<void> {
      const role = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
        name: `fixture-assign-line-viewer-role-${randomUUID()}`,
      });
      await assignRoleFixture(prisma, { user, role });
      await grantUnitScopeFixture(prisma, { user, orgUnitId: unitRiskId });
    }

    beforeAll(async () => {
      const prisma = ctx.app.get(PrismaService);

      const unitAncestor = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('assign-line-ancestor'),
      });
      unitAncestorId = unitAncestor.id;

      const unitRiskFixtureId = randomUUID();
      const unitRisk = await createOrgUnitFixture(prisma, {
        id: unitRiskFixtureId,
        code: uniqueTestMarker('assign-line-risk-unit'),
        parentId: unitAncestor.id,
        path: `${unitAncestor.path}${unitRiskFixtureId}/`,
        depth: 1,
      });
      unitRiskId = unitRisk.id;

      const unitSiblingFixtureId = randomUUID();
      const unitSibling = await createOrgUnitFixture(prisma, {
        id: unitSiblingFixtureId,
        code: uniqueTestMarker('assign-line-sibling-unit'),
        parentId: unitAncestor.id,
        path: `${unitAncestor.path}${unitSiblingFixtureId}/`,
        depth: 1,
      });
      unitSiblingId = unitSibling.id;

      const creatorFixture = await createLocalUserFixture(prisma, {
        email: `${uniqueTestMarker('assign-line-creator')}@example.test`,
      });
      const creatorRole = await createRoleWithPermissionsFixture(
        prisma,
        ['risk:create', 'risk:edit', 'risk:view'],
        { name: `fixture-assign-line-creator-role-${randomUUID()}` },
      );
      await assignRoleFixture(prisma, { user: creatorFixture.user, role: creatorRole });
      await grantGlobalScopeFixture(prisma, { user: creatorFixture.user });

      creatorAgent = request.agent(ctx.app.getHttpServer());
      const login = await creatorAgent
        .post('/api/v1/auth/login')
        .set('Origin', appOrigin)
        .send({ email: creatorFixture.user.email, password: creatorFixture.rawPassword });
      expect(login.status).toBe(200);
    });

    it("succeeds creating a risk whose owner's primary unit is an ANCESTOR of the risk's own unit — the real case this rule exists for", async () => {
      const prisma = ctx.app.get(PrismaService);
      const owner = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('assign-line-owner-ancestor')}@example.test`,
        primaryOrgUnitId: unitAncestorId,
      });
      await makeVisibleToRisk(prisma, owner);

      const response = await creatorAgent.post('/api/v1/risks').set('Origin', appOrigin).send({
        title: 'Risco com gestor em unidade ancestral',
        description: 'O gestor pertence a uma unidade ancestral da unidade do risco.',
        orgUnitId: unitRiskId,
        ownerUserId: owner.id,
      });

      expect(response.status).toBe(201);
      expect((response.body as RiskDetailBody).owner.id).toBe(owner.id);
    });

    it("refuses creating a risk whose owner's primary unit is a SIBLING branch, with the new 422 assignment-line refusal", async () => {
      const prisma = ctx.app.get(PrismaService);
      const owner = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('assign-line-owner-sibling')}@example.test`,
        primaryOrgUnitId: unitSiblingId,
      });

      const response = await creatorAgent.post('/api/v1/risks').set('Origin', appOrigin).send({
        title: 'Tentativa com gestor em unidade irmã',
        description: 'O gestor pertence a uma unidade irmã, fora da linha organizacional.',
        orgUnitId: unitRiskId,
        ownerUserId: owner.id,
      });

      expect(response.status).toBe(422);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.body as ValidationProblemBody;
      expect(body.detail).toBe(USER_MESSAGES.risk.ownerNotAssignable);
      expect(body.errors).toContainEqual({
        field: 'ownerUserId',
        message: USER_MESSAGES.risk.ownerNotAssignable,
      });
      expect(body.detail).not.toBe(USER_MESSAGES.risk.ownerNotFound);
    });

    it('succeeds creating a risk whose owner carries NO primary organizational unit at all — assignable anywhere', async () => {
      const prisma = ctx.app.get(PrismaService);
      const owner = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('assign-line-owner-no-unit')}@example.test`,
      });
      await makeVisibleToRisk(prisma, owner);

      const response = await creatorAgent.post('/api/v1/risks').set('Origin', appOrigin).send({
        title: 'Risco com gestor sem unidade organizacional',
        description: 'O gestor não possui unidade organizacional principal.',
        orgUnitId: unitRiskId,
        ownerUserId: owner.id,
      });

      expect(response.status).toBe(201);
      expect((response.body as RiskDetailBody).owner.id).toBe(owner.id);
    });

    it('leaves the existing "owner not found or inactive" refusal unchanged — same 422 status and same message as before this rule existed', async () => {
      const prisma = ctx.app.get(PrismaService);
      const inactiveOwner = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('assign-line-owner-inactive')}@example.test`,
        status: UserStatus.INACTIVE,
      });

      const nonexistentResponse = await creatorAgent
        .post('/api/v1/risks')
        .set('Origin', appOrigin)
        .send({
          title: 'Tentativa com gestor inexistente',
          description: 'Descrição.',
          orgUnitId: unitRiskId,
          ownerUserId: randomUUID(),
        });
      const inactiveResponse = await creatorAgent
        .post('/api/v1/risks')
        .set('Origin', appOrigin)
        .send({
          title: 'Tentativa com gestor inativo',
          description: 'Descrição.',
          orgUnitId: unitRiskId,
          ownerUserId: inactiveOwner.id,
        });

      for (const response of [nonexistentResponse, inactiveResponse]) {
        expect(response.status).toBe(422);
        const body = response.body as ValidationProblemBody;
        expect(body.detail).toBe(USER_MESSAGES.risk.ownerNotFound);
        expect(body.errors).toContainEqual({
          field: 'ownerUserId',
          message: USER_MESSAGES.risk.ownerNotFound,
        });
      }
    });

    it("refuses moving a risk's orgUnitId to a unit where the CURRENT owner is no longer assignable — the case a naive implementation silently skips, since ownerUserId is not even part of this request", async () => {
      const prisma = ctx.app.get(PrismaService);
      const owner = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('assign-line-owner-for-move')}@example.test`,
        primaryOrgUnitId: unitRiskId,
      });
      await makeVisibleToRisk(prisma, owner);

      const createResponse = await creatorAgent
        .post('/api/v1/risks')
        .set('Origin', appOrigin)
        .send({
          title: 'Risco a ser movido de unidade',
          description: 'Este risco será movido para uma unidade onde o gestor não é assinalável.',
          orgUnitId: unitRiskId,
          ownerUserId: owner.id,
        });
      expect(createResponse.status).toBe(201);
      const riskId = (createResponse.body as RiskDetailBody).id;

      const moveResponse = await creatorAgent
        .patch(`/api/v1/risks/${riskId}`)
        .set('Origin', appOrigin)
        .set('If-Match', formatETag(0))
        .send({ orgUnitId: unitSiblingId });

      expect(moveResponse.status).toBe(422);
      const body = moveResponse.body as ValidationProblemBody;
      expect(body.detail).toBe(USER_MESSAGES.risk.ownerNotAssignable);
      expect(body.errors).toContainEqual({
        field: 'ownerUserId',
        message: USER_MESSAGES.risk.ownerNotAssignable,
      });

      const getAfter = await creatorAgent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
      expect(getAfter.status).toBe(200);
      expect((getAfter.body as RiskDetailBody).orgUnit.id).toBe(unitRiskId);
    });
  });
});
