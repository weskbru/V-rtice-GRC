import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

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

interface AttachmentBody {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedBy: { readonly id: string; readonly fullName: string; readonly email: string };
  readonly createdAt: string;
  readonly contentUrl: string;
}

interface AttachmentPageBody {
  readonly data: readonly AttachmentBody[];
  readonly meta: { readonly page: number; readonly pageSize: number; readonly total: number };
}

function countFilesRecursively(root: string): number {
  if (!existsSync(root)) return 0;
  let count = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    count += entry.isDirectory() ? countFilesRecursively(entryPath) : 1;
  }
  return count;
}

describe('/attachments contract coverage (T190, D-11, FR-096 to FR-100)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let storageRoot: string;
  let riskId: string;
  let viewerAgent: ReturnType<typeof request.agent>;
  let uploaderAgent: ReturnType<typeof request.agent>;
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
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;
    storageRoot = appConfig.attachment.storagePath;
    const prisma = ctx.app.get(PrismaService);

    const orgUnit = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('att-org') });

    const setupRole = await createRoleWithPermissionsFixture(prisma, ['risk:create'], {
      name: `fixture-at-setup-role-${randomUUID()}`,
    });
    const setupUser = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('at-setup')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: setupUser, role: setupRole });
    await grantUnitScopeFixture(prisma, { user: setupUser, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('at-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
    const risk = await ctx.app.get(CreateRiskUseCase).execute({
      actorUserId: setupUser.id,
      title: 'Risco para anexos',
      description: 'Usado para cobertura de contrato de /attachments.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });
    riskId = risk.id;

    const viewerRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-at-viewer-role-${randomUUID()}`,
    });
    const viewer = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('at-viewer')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: viewer.user, role: viewerRole });
    await grantUnitScopeFixture(prisma, { user: viewer.user, orgUnitId: orgUnit.id });

    const uploaderRole = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:view', 'attachment:create'],
      { name: `fixture-at-uploader-role-${randomUUID()}` },
    );
    const uploader = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('at-uploader')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: uploader.user, role: uploaderRole });
    await grantUnitScopeFixture(prisma, { user: uploader.user, orgUnitId: orgUnit.id });

    const deleterRole = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:view', 'attachment:delete'],
      { name: `fixture-at-deleter-role-${randomUUID()}` },
    );
    const deleter = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('at-deleter')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: deleter.user, role: deleterRole });
    await grantUnitScopeFixture(prisma, { user: deleter.user, orgUnitId: orgUnit.id });

    viewerAgent = await login(viewer.user.email, viewer.rawPassword);
    uploaderAgent = await login(uploader.user.email, uploader.rawPassword);
    deleterAgent = await login(deleter.user.email, deleter.rawPassword);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function uploadPdf(fileName: string): Promise<AttachmentBody> {
    const response = await uploaderAgent
      .post('/api/v1/attachments')
      .set('Origin', appOrigin)
      .field('entityType', 'RISK')
      .field('entityId', riskId)
      .attach('file', Buffer.from('%PDF-1.7\nconteúdo de teste', 'utf-8'), {
        filename: fileName,
        contentType: 'application/pdf',
      });
    expect(response.status).toBe(201);
    return response.body as AttachmentBody;
  }

  describe('GET /attachments', () => {
    it('401 with no session', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/attachments')
        .query({ entityType: 'RISK', entityId: riskId });
      expect(response.status).toBe(401);
    });

    it('succeeds for a caller holding ONLY risk:view — no attachment-specific permission required to list', async () => {
      await uploadPdf('para-listagem.pdf');
      const response = await viewerAgent
        .get('/api/v1/attachments')
        .query({ entityType: 'RISK', entityId: riskId })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as AttachmentPageBody;
      expect(body.data.length).toBeGreaterThan(0);
      const raw = JSON.stringify(body);
      expect(raw).not.toMatch(/storageKey/i);
      expect(raw).not.toMatch(/[/\\]sha256[/\\]/);
      for (const item of body.data) {
        expect(item.contentUrl).toBe(`/api/v1/attachments/${item.id}/content`);
      }
    });
  });

  describe('POST /attachments', () => {
    it('401 with no session', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/attachments')
        .set('Origin', appOrigin)
        .field('entityType', 'RISK')
        .field('entityId', riskId)
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'x.pdf',
          contentType: 'application/pdf',
        });
      expect(response.status).toBe(401);
    });

    it('403 for a caller without attachment:create (holds only risk:view)', async () => {
      const response = await viewerAgent
        .post('/api/v1/attachments')
        .set('Origin', appOrigin)
        .field('entityType', 'RISK')
        .field('entityId', riskId)
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'x.pdf',
          contentType: 'application/pdf',
        });
      expect(response.status).toBe(403);
    });

    it('201 with Location header, the declared Attachment response shape, and original file name preserved as metadata', async () => {
      const created = await uploadPdf('relatório de risco.pdf');
      expect(created.fileName).toBe('relatório de risco.pdf');
      expect(created.contentType).toBe('application/pdf');
      expect(created.uploadedBy.fullName).toBeTruthy();
      expect(created.contentUrl).toBe(`/api/v1/attachments/${created.id}/content`);
    });

    it('a filename shaped like a path-traversal attempt cannot escape the storage root — defended in TWO independent layers (ADR-010)', async () => {
      const maliciousName = '../../etc/passwd';
      const before = countFilesRecursively(storageRoot);

      const response = await uploaderAgent
        .post('/api/v1/attachments')
        .set('Origin', appOrigin)
        .field('entityType', 'RISK')
        .field('entityId', riskId)
        .attach('file', Buffer.from(`%PDF-1.7\ntraversal attempt ${randomUUID()}`, 'ascii'), {
          filepath: maliciousName,
          contentType: 'application/pdf',
        } as unknown as {
          filename?: string;
          contentType?: string;
        });

      expect(response.status).toBe(201);
      const created = response.body as AttachmentBody;
      expect(created.fileName).toBe('passwd');
      const after = countFilesRecursively(storageRoot);
      expect(after).toBe(before + 1);

      const escapedPath = path.resolve(storageRoot, maliciousName);
      expect(existsSync(escapedPath)).toBe(false);
    });
  });

  describe('GET /attachments/{attachmentId}/content', () => {
    it('carries every FR-099 security header on a successful download', async () => {
      const created = await uploadPdf('com-cabecalhos.pdf');
      const response = await viewerAgent
        .get(`/api/v1/attachments/${created.id}/content`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('com-cabecalhos.pdf');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBe("default-src 'none'");
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(Number(response.headers['content-length'])).toBe(created.sizeBytes);
    });

    it('404 for a withdrawn attachment (subsequent content requests refuse, per contract)', async () => {
      const created = await uploadPdf('para-remover.pdf');
      const deleteResponse = await deleterAgent
        .delete(`/api/v1/attachments/${created.id}`)
        .set('Origin', appOrigin);
      expect(deleteResponse.status).toBe(204);

      const contentResponse = await viewerAgent
        .get(`/api/v1/attachments/${created.id}/content`)
        .set('Origin', appOrigin);
      expect(contentResponse.status).toBe(404);
    });
  });

  describe('DELETE /attachments/{attachmentId}', () => {
    it('401 with no session', async () => {
      const response = await request(ctx.app.getHttpServer())
        .delete(`/api/v1/attachments/${randomUUID()}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });

    it('403 for a caller without attachment:delete (holds only risk:view)', async () => {
      const created = await uploadPdf('sem-permissao-de-exclusao.pdf');
      const response = await viewerAgent
        .delete(`/api/v1/attachments/${created.id}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('404 for a nonexistent attachment id', async () => {
      const response = await deleterAgent
        .delete(`/api/v1/attachments/${randomUUID()}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('204 on success; a second delete on the same id then 404s (withdrawn, not erased — FR-102)', async () => {
      const created = await uploadPdf('para-dupla-exclusao.pdf');

      const first = await deleterAgent
        .delete(`/api/v1/attachments/${created.id}`)
        .set('Origin', appOrigin);
      expect(first.status).toBe(204);

      const second = await deleterAgent
        .delete(`/api/v1/attachments/${created.id}`)
        .set('Origin', appOrigin);
      expect(second.status).toBe(404);
    });
  });
});
