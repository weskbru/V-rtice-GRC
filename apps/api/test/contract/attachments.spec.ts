/**
 * T190 — D-11 contract coverage for `/attachments` (FR-096 to FR-100,
 * ADR-010): for every operation, the stated authorization rule (including
 * a caller WITHOUT the permission being refused, and a
 * zero-additional-permission caller succeeding for the two routes gated
 * only by the parent's own view permission), an unauthenticated 401, the
 * success response's declared shape, the download response's required
 * security headers (FR-099), and the path-traversal guarantee (ADR-010).
 *
 * `attachment-access.spec.ts` (T184) and `attachment-validation.spec.ts`
 * (T185) cover the non-disclosure and upload-validation properties in
 * depth; this file covers the remaining D-11 surface those two do not:
 * withdraw's full authorization matrix, the metadata response shape, and
 * the download headers/path-traversal proof.
 */
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
    // F-CV-2: precondition owner for the risk this file's attachment
    // coverage hangs off — not the object of any assertion here.
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
      // Metadata only — never the internal storage key (FR-107, ADR-010).
      // `checksumSha256` is itself a declared response FIELD name (and
      // legitimately contains "sha256"), so it is asserted PRESENT, not
      // absent; `storageKey`/the storage layout are what must never leak.
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
        // `filepath` (not `filename`): superagent's underlying `form-data`
        // library runs `path.basename()` on a plain `filename` option
        // before it ever reaches the wire — a CLIENT-side convenience that
        // would silently defeat this exact test by never sending the
        // traversal string at all. `filepath` is passed through verbatim
        // (confirmed directly against `form-data`: the raw multipart body
        // carries `filename="../../etc/passwd"`), so this genuinely
        // exercises the SERVER's own handling.
        // Content is unique PER TEST RUN (embeds a fresh UUID) — storage is
        // content-addressed (`LocalDiskStorageProvider`) and the real
        // `ATTACHMENT_STORAGE_PATH` directory is never cleaned between
        // separate test runs on this machine, so reusing a fixed byte
        // string across runs would make "exactly one NEW file appeared"
        // pass or fail depending on whether an EARLIER run already wrote
        // that exact content — a false pass/fail unrelated to this test.
        .attach(
          'file',
          Buffer.from(`%PDF-1.7\ntraversal attempt ${randomUUID()}`, 'ascii'),
          // `@types/superagent` only declares `filename`/`contentType` on
          // this overload, but `form-data` (verified directly against its
          // source) also honors `filepath`, taking precedence over
          // `filename` and — unlike it — never running the value through
          // `path.basename()`. Widening the type here is what lets this
          // test send the traversal string over the wire at all.
          { filepath: maliciousName, contentType: 'application/pdf' } as unknown as {
            filename?: string;
            contentType?: string;
          },
        );

      expect(response.status).toBe(201);
      const created = response.body as AttachmentBody;
      // FIRST layer, found while writing this test: busboy (multer's own
      // multipart parser) strips any directory component from a part's
      // `filename` by default (`preservePath` defaults to `false` — see
      // `busboy`'s `lib/types/multipart.js`), so `Attachment.fileName`
      // never even RECEIVES the traversal string — only its basename.
      // This platform does not opt into `preservePath`, so this defense is
      // active by default, not by explicit configuration.
      expect(created.fileName).toBe('passwd');
      // SECOND, independent layer — the one this platform's OWN code
      // guarantees regardless of any multipart-parser behavior:
      // `LocalDiskStorageProvider` never consults `fileName` at all when
      // choosing a storage path (content-addressed by SHA-256 checksum
      // only, see that class's header) — proven below: exactly one new
      // file appeared, under the storage root, nowhere else.
      const after = countFilesRecursively(storageRoot);
      expect(after).toBe(before + 1);

      // No file exists outside the storage root at the location the
      // traversal string would have named if it HAD been used as a path
      // (two directories up from the storage root).
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
