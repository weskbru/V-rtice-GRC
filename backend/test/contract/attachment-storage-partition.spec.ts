import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
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

import type { OrganizationalUnit } from '@prisma/client';

interface AttachmentBody {
  readonly id: string;
}

interface RiskUploaderFixture {
  readonly riskId: string;
  readonly agent: ReturnType<typeof request.agent>;
}

describe('Attachment storage key partition by organizational unit (F-26 fix)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let storageRoot: string;
  let prisma: PrismaService;

  async function login(email: string, password: string): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(ctx.app.getHttpServer());
    const response = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password });
    expect(response.status).toBe(200);
    return agent;
  }

  async function setUpRiskAndUploader(orgUnit: OrganizationalUnit): Promise<RiskUploaderFixture> {
    const setupRole = await createRoleWithPermissionsFixture(prisma, ['risk:create'], {
      name: `fixture-sp-setup-${randomUUID()}`,
    });
    const setupUser = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('sp-setup')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: setupUser, role: setupRole });
    await grantUnitScopeFixture(prisma, { user: setupUser, orgUnitId: orgUnit.id });

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('sp-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
    const risk = await ctx.app.get(CreateRiskUseCase).execute({
      actorUserId: setupUser.id,
      title: `Risco de partição de armazenamento (${orgUnit.code})`,
      description: 'Usado exclusivamente pela prova de partição de chave de armazenamento.',
      orgUnitId: orgUnit.id,
      ownerUserId: owner.id,
    });

    const uploaderRole = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:view', 'attachment:create'],
      { name: `fixture-sp-uploader-${randomUUID()}` },
    );
    const uploader = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('sp-uploader')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    await assignRoleFixture(prisma, { user: uploader.user, role: uploaderRole });
    await grantUnitScopeFixture(prisma, { user: uploader.user, orgUnitId: orgUnit.id });

    const agent = await login(uploader.user.email, uploader.rawPassword);
    return { riskId: risk.id, agent };
  }

  let fixtureA: RiskUploaderFixture;
  let fixtureB: RiskUploaderFixture;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;
    storageRoot = appConfig.attachment.storagePath;
    prisma = ctx.app.get(PrismaService);

    const orgUnitA = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('sp-org-a') });
    const orgUnitB = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('sp-org-b') });

    fixtureA = await setUpRiskAndUploader(orgUnitA);
    fixtureB = await setUpRiskAndUploader(orgUnitB);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('two uploads of IDENTICAL content under different organizational units produce two distinct stored objects', async () => {
    const identicalContent = Buffer.from(
      `%PDF-1.7\nfront-f storage partition proof ${randomUUID()}`,
      'utf-8',
    );

    const responseA = await fixtureA.agent
      .post('/api/v1/attachments')
      .set('Origin', appOrigin)
      .field('entityType', 'RISK')
      .field('entityId', fixtureA.riskId)
      .attach('file', identicalContent, { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(responseA.status).toBe(201);

    const responseB = await fixtureB.agent
      .post('/api/v1/attachments')
      .set('Origin', appOrigin)
      .field('entityType', 'RISK')
      .field('entityId', fixtureB.riskId)
      .attach('file', identicalContent, { filename: 'b.pdf', contentType: 'application/pdf' });
    expect(responseB.status).toBe(201);

    const attachmentA = await prisma.client.attachment.findUniqueOrThrow({
      where: { id: (responseA.body as AttachmentBody).id },
      select: { storageKey: true, checksumSha256: true },
    });
    const attachmentB = await prisma.client.attachment.findUniqueOrThrow({
      where: { id: (responseB.body as AttachmentBody).id },
      select: { storageKey: true, checksumSha256: true },
    });

    expect(attachmentA.checksumSha256).toBe(attachmentB.checksumSha256);

    expect(attachmentA.storageKey).not.toBe(attachmentB.storageKey);

    expect(existsSync(path.join(storageRoot, attachmentA.storageKey))).toBe(true);
    expect(existsSync(path.join(storageRoot, attachmentB.storageKey))).toBe(true);
  });
});
