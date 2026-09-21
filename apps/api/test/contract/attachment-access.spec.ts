/**
 * T184 — an attachment is unreachable by direct id without access to its
 * PARENT record (FR-098, FR-030, ADR-010). Proves, against the real
 * `/api/v1/attachments/{id}` and `/api/v1/attachments/{id}/content`
 * endpoints:
 *
 *   1. A caller who cannot see the parent risk (wrong organizational
 *      scope) is refused with 404, indistinguishable from a random,
 *      nonexistent attachment id — byte-for-byte identical `status`,
 *      `title`, `type` and `detail`.
 *   2. A caller who holds NO `risk:view` permission at all (global
 *      organizational scope, but no view permission whatsoever) is
 *      refused the same way — proving the refusal is permission-aware,
 *      not merely scope-aware.
 *   3. A caller who genuinely can see the parent risk succeeds.
 *   4. The same non-disclosing 404 holds for `DELETE
 *      /attachments/{attachmentId}` (a caller who holds `attachment:delete`
 *      but cannot see the parent).
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
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

interface AttachmentBody {
  readonly id: string;
}

describe('An attachment is unreachable by direct id without access to its parent record (T184, FR-098, FR-030)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let attachmentId: string;
  let riskOrgUnitId: string;
  let insiderAgent: ReturnType<typeof request.agent>;
  let outOfScopeAgent: ReturnType<typeof request.agent>;
  let noPermissionAgent: ReturnType<typeof request.agent>;

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

    const orgUnitInScope = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('attachment-access-in'),
    });
    const orgUnitOutOfScope = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('attachment-access-out'),
    });
    riskOrgUnitId = orgUnitInScope.id;

    const creatorRole = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:create', 'risk:view', 'attachment:create'],
      { name: `fixture-attachment-access-creator-role-${randomUUID()}` },
    );
    const creator = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('attachment-access-creator')}@example.test`,
      primaryOrgUnitId: orgUnitInScope.id,
    });
    await assignRoleFixture(prisma, { user: creator.user, role: creatorRole });
    await grantUnitScopeFixture(prisma, { user: creator.user, orgUnitId: orgUnitInScope.id });

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('attachment-access-owner')}@example.test`,
    });
    // F-CV-2: precondition owner for the risk this file's attachment tests
    // hang off — not the object of any assertion (that role belongs to
    // insider/outOfScope/noPermission below, all untouched).
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnitInScope.id });
    const risk = await ctx.app.get(CreateRiskUseCase).execute({
      actorUserId: creator.user.id,
      title: 'Risco com anexo restrito',
      description: 'Usado para provar o isolamento de acesso a anexos.',
      orgUnitId: orgUnitInScope.id,
      ownerUserId: owner.id,
    });

    // Insider: risk:view + UNIT scope covering the risk's own unit.
    const insiderRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-attachment-access-insider-role-${randomUUID()}`,
    });
    const insider = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('attachment-access-insider')}@example.test`,
      primaryOrgUnitId: orgUnitInScope.id,
    });
    await assignRoleFixture(prisma, { user: insider.user, role: insiderRole });
    await grantUnitScopeFixture(prisma, { user: insider.user, orgUnitId: orgUnitInScope.id });

    // Out-of-scope: HOLDS risk:view, but scoped only to a sibling unit.
    const outOfScopeRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-attachment-access-outscope-role-${randomUUID()}`,
    });
    const outOfScope = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('attachment-access-outscope')}@example.test`,
      primaryOrgUnitId: orgUnitOutOfScope.id,
    });
    await assignRoleFixture(prisma, { user: outOfScope.user, role: outOfScopeRole });
    await grantUnitScopeFixture(prisma, { user: outOfScope.user, orgUnitId: orgUnitOutOfScope.id });

    // No-permission: GLOBAL scope (would see every risk by scope alone)
    // but holds NO risk:view permission at all.
    const noPermission = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('attachment-access-noperm')}@example.test`,
    });
    await grantGlobalScopeFixture(prisma, { user: noPermission.user });

    insiderAgent = await login(insider.user.email, insider.rawPassword);
    outOfScopeAgent = await login(outOfScope.user.email, outOfScope.rawPassword);
    noPermissionAgent = await login(noPermission.user.email, noPermission.rawPassword);

    const creatorAgent = await login(creator.user.email, creator.rawPassword);
    const uploadResponse = await creatorAgent
      .post('/api/v1/attachments')
      .set('Origin', appOrigin)
      .field('entityType', 'RISK')
      .field('entityId', risk.id)
      .attach('file', Buffer.from('%PDF-1.7\nevidence', 'ascii'), {
        filename: 'evidencia.pdf',
        contentType: 'application/pdf',
      });
    expect(uploadResponse.status).toBe(201);
    attachmentId = (uploadResponse.body as AttachmentBody).id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('the insider (in-scope, holds risk:view) can download the attachment content (200)', async () => {
    const response = await insiderAgent
      .get(`/api/v1/attachments/${attachmentId}/content`)
      .set('Origin', appOrigin);
    expect(response.status).toBe(200);
  });

  it('an out-of-scope caller who HOLDS risk:view is refused (404), not merely denied the risk itself', async () => {
    const response = await outOfScopeAgent
      .get(`/api/v1/attachments/${attachmentId}/content`)
      .set('Origin', appOrigin);
    expect(response.status).toBe(404);
  });

  it('a caller with NO risk:view permission at all (but GLOBAL scope) is refused the same way (404, not 403)', async () => {
    const response = await noPermissionAgent
      .get(`/api/v1/attachments/${attachmentId}/content`)
      .set('Origin', appOrigin);
    expect(response.status).toBe(404);
  });

  it('the out-of-scope 404 is byte-for-byte identical to the 404 for a random, nonexistent attachment id (FR-030)', async () => {
    const nonexistentId = randomUUID();

    const realButInaccessible = await outOfScopeAgent
      .get(`/api/v1/attachments/${attachmentId}/content`)
      .set('Origin', appOrigin);
    const nonexistent = await outOfScopeAgent
      .get(`/api/v1/attachments/${nonexistentId}/content`)
      .set('Origin', appOrigin);

    expect(realButInaccessible.status).toBe(404);
    expect(nonexistent.status).toBe(404);

    const realBody = realButInaccessible.body as ProblemBody;
    const nonexistentBody = nonexistent.body as ProblemBody;

    expect(realBody.status).toBe(nonexistentBody.status);
    expect(realBody.title).toBe(nonexistentBody.title);
    expect(realBody.type).toBe(nonexistentBody.type);
    // `detail` embeds the id the caller themselves supplied — comparing
    // for equality would be wrong (they necessarily differ); what FR-030
    // requires is that both follow the IDENTICAL template, keyed by the
    // ATTACHMENT's own id, never the parent risk's — see
    // `core/files/application/attachment-access.ts`'s header for why.
    expect(realBody.detail).toBe(`Anexo ${attachmentId} não foi encontrado(a).`);
    expect(nonexistentBody.detail).toBe(`Anexo ${nonexistentId} não foi encontrado(a).`);

    const raw = JSON.stringify(realButInaccessible.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
    // The storage layout must never leak through the refusal either.
    expect(raw).not.toMatch(/sha256/i);
    expect(raw).not.toContain(riskOrgUnitId);
  });

  it('DELETE /attachments/{id} refuses the same way for a caller who holds attachment:delete but cannot see the parent (404)', async () => {
    const prisma = ctx.app.get(PrismaService);
    const deleterRole = await createRoleWithPermissionsFixture(prisma, ['attachment:delete'], {
      name: `fixture-attachment-access-deleter-role-${randomUUID()}`,
    });
    const outOfScopeOrgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('attachment-access-deleter-out'),
    });
    const deleter = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('attachment-access-deleter')}@example.test`,
      primaryOrgUnitId: outOfScopeOrgUnit.id,
    });
    await assignRoleFixture(prisma, { user: deleter.user, role: deleterRole });
    await grantUnitScopeFixture(prisma, { user: deleter.user, orgUnitId: outOfScopeOrgUnit.id });
    const deleterAgent = await login(deleter.user.email, deleter.rawPassword);

    const response = await deleterAgent
      .delete(`/api/v1/attachments/${attachmentId}`)
      .set('Origin', appOrigin);

    expect(response.status).toBe(404);

    // Proves the refusal did not partially apply — the attachment is
    // still there for the insider afterward.
    const stillThere = await insiderAgent
      .get(`/api/v1/attachments/${attachmentId}/content`)
      .set('Origin', appOrigin);
    expect(stillThere.status).toBe(200);
  });
});
