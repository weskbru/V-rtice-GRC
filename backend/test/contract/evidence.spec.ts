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
  createOrgUnitFixture,
  createUserFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ProblemBody {
  readonly status: number;
  readonly title?: string;
  readonly detail?: string;
}

interface EvidenceBody {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: { readonly id: string };
  readonly title: string;
  readonly status: string;
  readonly expired: boolean;
  readonly externalUrl: string | null;
  readonly observation: string | null;
  readonly archivedAt: string | null;
  readonly linkCount: number;
}

interface EvidencePageBody {
  readonly items: readonly EvidenceBody[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

describe('Evidence contract (T017/T019/T020/T023/T024, US1, D-11)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let otherOrgUnitId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('evidence-contract-org'),
    });
    orgUnitId = orgUnit.id;
    const otherOrgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('evidence-contract-other-org'),
    });
    otherOrgUnitId = otherOrgUnit.id;
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('evidence-contract-owner')}@example.test`,
    });
    ownerUserId = owner.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
    scopedOrgUnitId: string = orgUnitId,
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('evidence-actor')}@example.test`,
      primaryOrgUnitId: scopedOrgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-evidence-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: scopedOrgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, userId: fixture.user.id };
  }

  function validCreateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      orgUnitId,
      title: 'Relatório de teste de intrusão',
      type: 'DOCUMENT',
      source: 'MANUAL_UPLOAD',
      ownerUserId,
      collectedOn: '2026-03-01',
      observation: 'Relatório cobrindo a API administrativa.',
      ...overrides,
    };
  }

  async function createEvidence(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<EvidenceBody> {
    const response = await agent
      .post('/api/v1/evidence')
      .set('Origin', appOrigin)
      .send(validCreateBody(overrides));
    expect(response.status).toBe(201);
    return response.body as EvidenceBody;
  }

  describe('POST /evidence', () => {
    it('succeeds for a caller holding evidence:create and returns the declared Evidence shape', async () => {
      const { agent } = await agentWithPermissions(['evidence:create', 'evidence:view']);
      const evidence = await createEvidence(agent);

      expect(evidence.id).toBeTruthy();
      expect(evidence.code).toMatch(/^EVD-\d{4}-\d{4,}$/);
      expect(evidence.orgUnit.id).toBe(orgUnitId);
      expect(evidence.status).toBe('ACTIVE');
      expect(evidence.expired).toBe(false);
      expect(evidence.archivedAt).toBeNull();
      expect(evidence.linkCount).toBe(0);
    });

    it('refuses a caller lacking evidence:create — 403', async () => {
      const { agent } = await agentWithPermissions(['evidence:view']);
      const response = await agent
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send(validCreateBody());
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send(validCreateBody());
      expect(response.status).toBe(401);
      const body = response.body as ProblemBody;
      expect(body.status).toBe(401);
    });

    it('Invariant E1 (FR-002, revised): rejects evidence with no externalUrl/observation', async () => {
      const { agent } = await agentWithPermissions(['evidence:create']);
      const response = await agent
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send(validCreateBody({ observation: undefined }));
      expect(response.status).toBe(422);
    });

    it('Invariant E1: accepts evidence with only observation (no externalUrl, no file)', async () => {
      const { agent } = await agentWithPermissions(['evidence:create']);
      const evidence = await createEvidence(agent, {
        observation: 'Prova registrada apenas em texto.',
      });
      expect(evidence.observation).toBe('Prova registrada apenas em texto.');
      expect(evidence.externalUrl).toBeNull();
    });

    it('Invariant E1: accepts evidence with only externalUrl', async () => {
      const { agent } = await agentWithPermissions(['evidence:create']);
      const evidence = await createEvidence(agent, {
        observation: undefined,
        externalUrl: 'https://example.org/relatorio.pdf',
      });
      expect(evidence.externalUrl).toBe('https://example.org/relatorio.pdf');
    });

    it('creation outside the caller scope is refused with 422, not 404 (no existing record to disclose)', async () => {
      const { agent } = await agentWithPermissions(['evidence:create'], orgUnitId);
      const response = await agent
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send(validCreateBody({ orgUnitId: otherOrgUnitId }));
      expect(response.status).toBe(422);
    });

    it('a real out-of-scope orgUnitId and a nonexistent orgUnitId produce the byte-identical 422 message', async () => {
      const { agent } = await agentWithPermissions(['evidence:create'], orgUnitId);

      const outOfScopeResponse = await agent
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send(validCreateBody({ orgUnitId: otherOrgUnitId }));
      const nonexistentResponse = await agent
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send(validCreateBody({ orgUnitId: randomUUID() }));

      expect(outOfScopeResponse.status).toBe(422);
      expect(nonexistentResponse.status).toBe(422);
      const outOfScopeBody = outOfScopeResponse.body as ProblemBody;
      const nonexistentBody = nonexistentResponse.body as ProblemBody;
      expect(outOfScopeBody.title).toBe(nonexistentBody.title);
      expect(outOfScopeBody.detail).toBe(nonexistentBody.detail);
    });

    it('emits a distinct evidence.created audit event, not a generic evidence.updated', async () => {
      const { agent } = await agentWithPermissions(['evidence:create']);
      const evidence = await createEvidence(agent);

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { action: 'evidence.created', entityId: evidence.id },
      });
      expect(auditRow).not.toBeNull();
      expect(auditRow?.organizationalUnitId).toBe(orgUnitId);
    });
  });

  describe('GET /evidence/{evidenceId}', () => {
    it('succeeds for a caller holding evidence:view', async () => {
      const { agent } = await agentWithPermissions(['evidence:create', 'evidence:view']);
      const evidence = await createEvidence(agent);

      const response = await agent.get(`/api/v1/evidence/${evidence.id}`).set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect((response.body as EvidenceBody).id).toBe(evidence.id);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/v1/evidence/${randomUUID()}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });

    it('SC-005: a record outside the caller scope is byte-identical to a genuinely unknown id (404)', async () => {
      const { agent: creator } = await agentWithPermissions(
        ['evidence:create', 'evidence:view'],
        orgUnitId,
      );
      const evidence = await createEvidence(creator);

      const { agent: outsider } = await agentWithPermissions(['evidence:view'], otherOrgUnitId);

      const outOfScopeResponse = await outsider
        .get(`/api/v1/evidence/${evidence.id}`)
        .set('Origin', appOrigin);
      const unknownResponse = await outsider
        .get(`/api/v1/evidence/${randomUUID()}`)
        .set('Origin', appOrigin);

      expect(outOfScopeResponse.status).toBe(404);
      expect(unknownResponse.status).toBe(404);
      const outOfScopeBody = outOfScopeResponse.body as ProblemBody;
      const unknownBody = unknownResponse.body as ProblemBody;
      expect(outOfScopeBody.title).toBe(unknownBody.title);
      expect(outOfScopeBody.status).toBe(unknownBody.status);
      expect((outOfScopeResponse.body as { type: string }).type).toBe(
        (unknownResponse.body as { type: string }).type,
      );
    });
  });

  describe('GET /evidence', () => {
    it('lists evidence within the caller scope and returns the declared page shape', async () => {
      const { agent } = await agentWithPermissions(['evidence:create', 'evidence:view']);
      await createEvidence(agent);

      const response = await agent.get('/api/v1/evidence').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as EvidencePageBody;
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.page).toBe(1);
      expect(body.total).toBeGreaterThanOrEqual(1);
    });

    it('refuses a caller lacking evidence:view — 403', async () => {
      const { agent } = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/evidence').set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('the negation above is audited with a DENIED outcome (FR-030)', async () => {
      const prisma = ctx.app.get(PrismaService);
      const before = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });

      const { agent } = await agentWithPermissions([]);
      await agent.get('/api/v1/evidence').set('Origin', appOrigin);

      const after = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('PATCH /evidence/{evidenceId}', () => {
    it('succeeds for a caller holding evidence:edit and updates the declared fields', async () => {
      const { agent } = await agentWithPermissions([
        'evidence:create',
        'evidence:view',
        'evidence:edit',
      ]);
      const evidence = await createEvidence(agent);

      const response = await agent
        .patch(`/api/v1/evidence/${evidence.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Título atualizado' });
      expect(response.status).toBe(200);
      expect((response.body as EvidenceBody).title).toBe('Título atualizado');
    });

    it('refuses a caller lacking evidence:edit — 403', async () => {
      const { agent: creator } = await agentWithPermissions(['evidence:create', 'evidence:view']);
      const evidence = await createEvidence(creator);

      const response = await creator
        .patch(`/api/v1/evidence/${evidence.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Não deveria funcionar' });
      expect(response.status).toBe(403);
    });

    it('Invariant E1 re-checked on update: clearing the only form of substance is refused (422)', async () => {
      const { agent } = await agentWithPermissions([
        'evidence:create',
        'evidence:view',
        'evidence:edit',
      ]);
      const evidence = await createEvidence(agent, {
        observation: 'Único conteúdo desta evidência.',
        externalUrl: undefined,
      });

      const response = await agent
        .patch(`/api/v1/evidence/${evidence.id}`)
        .set('Origin', appOrigin)
        .send({ observation: '' });
      expect(response.status).toBe(422);
    });

    it('an archived evidence rejects metadata edits with 422 (FR-009)', async () => {
      const { agent } = await agentWithPermissions([
        'evidence:create',
        'evidence:view',
        'evidence:edit',
        'evidence:administer',
      ]);
      const evidence = await createEvidence(agent);
      const archiveResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/archive`)
        .set('Origin', appOrigin);
      expect(archiveResponse.status).toBe(200);

      const response = await agent
        .patch(`/api/v1/evidence/${evidence.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Não deveria funcionar' });
      expect(response.status).toBe(422);
    });
  });

  describe('POST /evidence/{evidenceId}/archive', () => {
    it('succeeds for a caller holding evidence:administer and preserves the record (never deleted)', async () => {
      const { agent } = await agentWithPermissions([
        'evidence:create',
        'evidence:view',
        'evidence:administer',
      ]);
      const evidence = await createEvidence(agent);

      const response = await agent
        .post(`/api/v1/evidence/${evidence.id}/archive`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as EvidenceBody;
      expect(body.status).toBe('ARCHIVED');
      expect(body.archivedAt).not.toBeNull();

      const getResponse = await agent
        .get(`/api/v1/evidence/${evidence.id}`)
        .set('Origin', appOrigin);
      expect(getResponse.status).toBe(200);
    });

    it('refuses a caller lacking evidence:administer — 403', async () => {
      const { agent: creator } = await agentWithPermissions(['evidence:create', 'evidence:view']);
      const evidence = await createEvidence(creator);

      const response = await creator
        .post(`/api/v1/evidence/${evidence.id}/archive`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('archiving an already-archived evidence is refused with 409', async () => {
      const { agent } = await agentWithPermissions([
        'evidence:create',
        'evidence:view',
        'evidence:administer',
      ]);
      const evidence = await createEvidence(agent);
      const first = await agent
        .post(`/api/v1/evidence/${evidence.id}/archive`)
        .set('Origin', appOrigin);
      expect(first.status).toBe(200);

      const second = await agent
        .post(`/api/v1/evidence/${evidence.id}/archive`)
        .set('Origin', appOrigin);
      expect(second.status).toBe(409);
    });

    it('emits a distinct evidence.archived audit event', async () => {
      const { agent } = await agentWithPermissions([
        'evidence:create',
        'evidence:view',
        'evidence:administer',
      ]);
      const evidence = await createEvidence(agent);
      await agent.post(`/api/v1/evidence/${evidence.id}/archive`).set('Origin', appOrigin);

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { action: 'evidence.archived', entityId: evidence.id },
      });
      expect(auditRow).not.toBeNull();
    });

    it('an out-of-scope evidence archives as 404, not 403 (SC-005)', async () => {
      const { agent: creator } = await agentWithPermissions(
        ['evidence:create', 'evidence:view'],
        orgUnitId,
      );
      const evidence = await createEvidence(creator);

      const { agent: outsider } = await agentWithPermissions(
        ['evidence:administer'],
        otherOrgUnitId,
      );
      const response = await outsider
        .post(`/api/v1/evidence/${evidence.id}/archive`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });
  });

  describe('POST /attachments with entityType: EVIDENCE (the corrected file mechanism)', () => {
    it('attaches a file to an existing evidence record', async () => {
      const { agent } = await agentWithPermissions([
        'evidence:create',
        'evidence:view',
        'attachment:create',
      ]);
      const evidence = await createEvidence(agent);

      const response = await agent
        .post('/api/v1/attachments')
        .set('Origin', appOrigin)
        .field('entityType', 'EVIDENCE')
        .field('entityId', evidence.id)
        .attach('file', Buffer.from('%PDF-1.7\nconteudo de teste', 'utf-8'), {
          filename: 'relatorio.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(201);
      const body = response.body as { id: string; contentUrl: string };
      expect(body.id).toBeTruthy();

      const listResponse = await agent
        .get('/api/v1/attachments')
        .query({ entityType: 'EVIDENCE', entityId: evidence.id })
        .set('Origin', appOrigin);
      expect(listResponse.status).toBe(200);
      const list = listResponse.body as { data: readonly { id: string }[] };
      expect(list.data.map((item) => item.id)).toContain(body.id);
    });

    it('refuses attaching to an evidence outside the caller scope — 404 (FR-032)', async () => {
      const { agent: creator } = await agentWithPermissions(
        ['evidence:create', 'evidence:view'],
        orgUnitId,
      );
      const evidence = await createEvidence(creator);

      const { agent: outsider } = await agentWithPermissions(
        ['evidence:view', 'attachment:create'],
        otherOrgUnitId,
      );
      const response = await outsider
        .post('/api/v1/attachments')
        .set('Origin', appOrigin)
        .field('entityType', 'EVIDENCE')
        .field('entityId', evidence.id)
        .attach('file', Buffer.from('%PDF-1.7\nconteudo de teste', 'utf-8'), {
          filename: 'relatorio.pdf',
          contentType: 'application/pdf',
        });
      expect(response.status).toBe(404);
    });

    it('refuses attaching to a nonexistent evidence id — 404', async () => {
      const { agent } = await agentWithPermissions(['evidence:view', 'attachment:create']);
      const response = await agent
        .post('/api/v1/attachments')
        .set('Origin', appOrigin)
        .field('entityType', 'EVIDENCE')
        .field('entityId', randomUUID())
        .attach('file', Buffer.from('%PDF-1.7\nconteudo de teste', 'utf-8'), {
          filename: 'relatorio.pdf',
          contentType: 'application/pdf',
        });
      expect(response.status).toBe(404);
    });
  });
});
