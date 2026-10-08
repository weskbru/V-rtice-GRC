import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { buildContractTestApp, type ContractTestContext } from '../contract/support/contract-app';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
  makeRiskAssignmentVisible,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import {
  createLocalUserFixture,
  createOrgUnitFixture,
  createUserFixture,
} from './support/fixtures';

interface ProblemBody {
  readonly status: number;
}

function countFilesRecursively(root: string): number {
  if (!existsSync(root)) {
    return 0;
  }
  let count = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      count += countFilesRecursively(entryPath);
    } else {
      count += 1;
    }
  }
  return count;
}

describe('Attachment upload validation — nothing stored on rejection (T185, FR-097, ADR-010)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let storageRoot: string;
  let maxSizeBytes: number;
  let riskId: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;
    storageRoot = appConfig.attachment.storagePath;
    maxSizeBytes = appConfig.attachment.maxSizeBytes;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('aval-org'),
    });

    const creatorRole = await createRoleWithPermissionsFixture(prisma, ['risk:create'], {
      name: `fixture-av-creator-role-${randomUUID()}`,
    });
    const creator = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('av-creator')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: creator, role: creatorRole });
    await grantUnitScopeFixture(prisma, { user: creator, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('av-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
    const risk = await ctx.app.get(CreateRiskUseCase).execute({
      actorUserId: creator.id,
      title: 'Risco para validação de upload',
      description: 'Usado para provar que uploads rejeitados nada armazenam.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });
    riskId = risk.id;

    const uploaderFixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('av-uploader')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const uploaderRole = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:view', 'attachment:create'],
      { name: `fixture-av-uploader-role-${randomUUID()}` },
    );
    await assignRoleFixture(prisma, { user: uploaderFixture.user, role: uploaderRole });
    await grantUnitScopeFixture(prisma, { user: uploaderFixture.user, orgUnitId: orgUnit.id });

    agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: uploaderFixture.user.email, password: uploaderFixture.rawPassword });
    expect(loginResponse.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function attachmentCountForRisk(): Promise<number> {
    const prisma = ctx.app.get(PrismaService);
    return prisma.client.attachment.count({ where: { entityType: 'RISK', entityId: riskId } });
  }

  it('rejects a disallowed declared content type (422) with nothing stored on disk or in the database', async () => {
    const filesBefore = countFilesRecursively(storageRoot);
    const dbCountBefore = await attachmentCountForRisk();

    const response = await agent
      .post('/api/v1/attachments')
      .set('Origin', appOrigin)
      .field('entityType', 'RISK')
      .field('entityId', riskId)
      .attach('file', Buffer.from([0x4d, 0x5a, 0x90, 0x00]), {
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
      });

    expect(response.status).toBe(422);
    expect((response.body as ProblemBody).status).toBe(422);

    expect(await attachmentCountForRisk()).toBe(dbCountBefore);
    expect(countFilesRecursively(storageRoot)).toBe(filesBefore);
  });

  it('rejects a declared type that does not match the sniffed magic bytes (422) with nothing stored', async () => {
    const filesBefore = countFilesRecursively(storageRoot);
    const dbCountBefore = await attachmentCountForRisk();

    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

    const response = await agent
      .post('/api/v1/attachments')
      .set('Origin', appOrigin)
      .field('entityType', 'RISK')
      .field('entityId', riskId)
      .attach('file', pngBytes, { filename: 'disguised.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(422);
    expect((response.body as ProblemBody).status).toBe(422);

    expect(await attachmentCountForRisk()).toBe(dbCountBefore);
    expect(countFilesRecursively(storageRoot)).toBe(filesBefore);
  });

  it('rejects an oversized upload (413) with nothing stored', async () => {
    const filesBefore = countFilesRecursively(storageRoot);
    const dbCountBefore = await attachmentCountForRisk();

    const oversized = Buffer.alloc(maxSizeBytes + 1, 0x41);
    Buffer.from('%PDF-', 'ascii').copy(oversized, 0);

    const response = await agent
      .post('/api/v1/attachments')
      .set('Origin', appOrigin)
      .field('entityType', 'RISK')
      .field('entityId', riskId)
      .attach('file', oversized, { filename: 'huge.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(413);
    expect((response.body as ProblemBody).status).toBe(413);

    expect(await attachmentCountForRisk()).toBe(dbCountBefore);
    expect(countFilesRecursively(storageRoot)).toBe(filesBefore);
  }, 30000);

  it('a valid, allow-listed upload DOES succeed and IS stored — proving the three rejections above are not false negatives from a broken happy path', async () => {
    const filesBefore = countFilesRecursively(storageRoot);
    const dbCountBefore = await attachmentCountForRisk();

    const response = await agent
      .post('/api/v1/attachments')
      .set('Origin', appOrigin)
      .field('entityType', 'RISK')
      .field('entityId', riskId)
      .attach('file', Buffer.from(`%PDF-1.7\n%real pdf content ${randomUUID()}`, 'ascii'), {
        filename: 'evidence.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(201);
    expect(await attachmentCountForRisk()).toBe(dbCountBefore + 1);
    expect(countFilesRecursively(storageRoot)).toBe(filesBefore + 1);
  });
});
