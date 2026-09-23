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

interface CommentBody {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly body: string;
  readonly author: { readonly id: string; readonly fullName: string; readonly email: string };
  readonly createdAt: string;
}

interface CommentPageBody {
  readonly data: readonly CommentBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

describe('/comments contract coverage (T192, D-11, FR-095, FR-098, FR-100)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let riskId: string;
  let viewerAgent: ReturnType<typeof request.agent>;
  let creatorAgent: ReturnType<typeof request.agent>;
  let deleterAgent: ReturnType<typeof request.agent>;

  async function login(email: string, password: string): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(ctx.app.getHttpServer());
    const response = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password });
    expect(response.status).toBe(200);
    return agent;
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    const prisma = ctx.app.get(PrismaService);

    const orgUnit = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('cmt-org') });

    const setupRole = await createRoleWithPermissionsFixture(prisma, ['risk:create'], {
      name: `fixture-cm-setup-role-${randomUUID()}`,
    });
    const setupUser = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('cm-setup')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: setupUser, role: setupRole });
    await grantUnitScopeFixture(prisma, { user: setupUser, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('cm-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
    const risk = await ctx.app.get(CreateRiskUseCase).execute({
      actorUserId: setupUser.id,
      title: 'Risco para comentários',
      description: 'Usado para cobertura de contrato de /comments.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });
    riskId = risk.id;

    const viewerRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-cm-viewer-role-${randomUUID()}`,
    });
    const viewer = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('cm-viewer')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: viewer.user, role: viewerRole });
    await grantUnitScopeFixture(prisma, { user: viewer.user, orgUnitId: orgUnit.id });

    const creatorRole = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:view', 'comment:create'],
      { name: `fixture-cm-creator-role-${randomUUID()}` },
    );
    const creator = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('cm-creator')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: creator.user, role: creatorRole });
    await grantUnitScopeFixture(prisma, { user: creator.user, orgUnitId: orgUnit.id });

    const deleterRole = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:view', 'comment:delete'],
      { name: `fixture-cm-deleter-role-${randomUUID()}` },
    );
    const deleter = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('cm-deleter')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: deleter.user, role: deleterRole });
    await grantUnitScopeFixture(prisma, { user: deleter.user, orgUnitId: orgUnit.id });

    viewerAgent = await login(viewer.user.email, viewer.rawPassword);
    creatorAgent = await login(creator.user.email, creator.rawPassword);
    deleterAgent = await login(deleter.user.email, deleter.rawPassword);
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /comments', () => {
    it('401 with no session', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/comments')
        .query({ entityType: 'RISK', entityId: riskId });
      expect(response.status).toBe(401);
    });

    it('succeeds for a caller holding ONLY risk:view — no comment-specific permission is required to list', async () => {
      const response = await viewerAgent
        .get('/api/v1/comments')
        .query({ entityType: 'RISK', entityId: riskId })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as CommentPageBody;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toMatchObject({ page: 1, pageSize: 25 });
    });

    it('400 when entityType/entityId are missing (required query parameters)', async () => {
      const response = await viewerAgent.get('/api/v1/comments').set('Origin', appOrigin);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /comments', () => {
    it('401 with no session', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/comments')
        .set('Origin', appOrigin)
        .send({ entityType: 'RISK', entityId: riskId, body: 'x' });
      expect(response.status).toBe(401);
    });

    it('403 for a caller without comment:create (holds only risk:view)', async () => {
      const response = await viewerAgent
        .post('/api/v1/comments')
        .set('Origin', appOrigin)
        .send({ entityType: 'RISK', entityId: riskId, body: 'Tentativa sem permissão.' });
      expect(response.status).toBe(403);
    });

    it('201, with Location header and the declared Comment response shape, author/timestamp taken from the session', async () => {
      const bodyText = 'Comentário de teste <script>alert(1)</script> armazenado como texto puro.';
      const response = await creatorAgent
        .post('/api/v1/comments')
        .set('Origin', appOrigin)
        .send({ entityType: 'RISK', entityId: riskId, body: bodyText });

      expect(response.status).toBe(201);
      expect(response.headers.location).toMatch(/\/api\/v1\/comments\/[0-9a-f-]+$/);

      const created = response.body as CommentBody;
      expect(created.entityType).toBe('RISK');
      expect(created.entityId).toBe(riskId);
      expect(created.body).toBe(bodyText);
      expect(created.author.fullName).toBeTruthy();
      expect(created.createdAt).toBeTruthy();
    });

    it('400 for a body outside the declared length bounds (request-shape validation)', async () => {
      const response = await creatorAgent
        .post('/api/v1/comments')
        .set('Origin', appOrigin)
        .send({ entityType: 'RISK', entityId: riskId, body: '' });
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /comments/{commentId}', () => {
    it('401 with no session', async () => {
      const response = await request(ctx.app.getHttpServer())
        .delete(`/api/v1/comments/${randomUUID()}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });

    it('403 for a caller without comment:delete (holds only risk:view)', async () => {
      const createResponse = await creatorAgent
        .post('/api/v1/comments')
        .set('Origin', appOrigin)
        .send({ entityType: 'RISK', entityId: riskId, body: 'Para tentativa de exclusão negada.' });
      const commentId = (createResponse.body as CommentBody).id;

      const response = await viewerAgent
        .delete(`/api/v1/comments/${commentId}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('404 for a nonexistent comment id', async () => {
      const response = await deleterAgent
        .delete(`/api/v1/comments/${randomUUID()}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('204 on success, and the comment is excluded from subsequent listings (withdrawn, not erased)', async () => {
      const createResponse = await creatorAgent
        .post('/api/v1/comments')
        .set('Origin', appOrigin)
        .send({ entityType: 'RISK', entityId: riskId, body: 'Este comentário será removido.' });
      const commentId = (createResponse.body as CommentBody).id;

      const deleteResponse = await deleterAgent
        .delete(`/api/v1/comments/${commentId}`)
        .set('Origin', appOrigin);
      expect(deleteResponse.status).toBe(204);

      const listResponse = await viewerAgent
        .get('/api/v1/comments')
        .query({ entityType: 'RISK', entityId: riskId, pageSize: 100 })
        .set('Origin', appOrigin);
      const listed = listResponse.body as CommentPageBody;
      expect(listed.data.some((c) => c.id === commentId)).toBe(false);

      const secondDelete = await deleterAgent
        .delete(`/api/v1/comments/${commentId}`)
        .set('Origin', appOrigin);
      expect(secondDelete.status).toBe(404);
    });
  });
});
