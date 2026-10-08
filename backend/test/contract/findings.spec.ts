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

interface FindingBody {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: { readonly id: string };
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly origin: string;
  readonly severity: string;
  readonly priority: string;
  readonly status: string;
  readonly openActionCount: number;
  readonly evidenceCount: number;
  readonly closedAt: string | null;
  readonly closureJustification: string | null;
}

interface FindingPageBody {
  readonly items: readonly FindingBody[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

interface ActionBody {
  readonly id: string;
  readonly originType: string;
  readonly originId: string;
}

interface EvidenceBody {
  readonly id: string;
}

describe('Finding contract (T059-T066b, US3, D-11)', () => {
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
      code: uniqueTestMarker('finding-contract-org'),
    });
    orgUnitId = orgUnit.id;
    const otherOrgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('finding-contract-other-org'),
    });
    otherOrgUnitId = otherOrgUnit.id;
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('finding-contract-owner')}@example.test`,
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
      email: `${uniqueTestMarker('finding-actor')}@example.test`,
      primaryOrgUnitId: scopedOrgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-finding-role-${randomUUID()}`,
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
      title: 'Segregação de funções não aplicada em aprovações financeiras',
      description: 'A autoavaliação identificou que o mesmo usuário solicita e aprova pagamentos.',
      category: 'NONCONFORMITY',
      origin: 'INTERNAL_ASSESSMENT',
      severity: 'HIGH',
      priority: 'HIGH',
      ownerUserId,
      identifiedOn: '2026-02-01',
      ...overrides,
    };
  }

  async function createFindingViaApi(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<FindingBody> {
    const response = await agent
      .post('/api/v1/findings')
      .set('Origin', appOrigin)
      .send(validCreateBody(overrides));
    expect(response.status).toBe(201);
    return response.body as FindingBody;
  }

  const FULL_LIFECYCLE_PERMISSIONS: readonly PermissionIdentifier[] = [
    'finding:create',
    'finding:view',
    'finding:edit',
    'finding:close',
    'finding:administer',
    'finding:remediate',
    'action:create',
    'action:view',
    'action:edit',
    'evidence:create',
    'evidence:view',
    'evidence:link',
  ];

  async function attachEvidenceToFinding(
    agent: ReturnType<typeof request.agent>,
    findingId: string,
  ): Promise<void> {
    const evidenceResponse = await agent
      .post('/api/v1/evidence')
      .set('Origin', appOrigin)
      .send({
        orgUnitId,
        title: uniqueTestMarker('evidencia-fechamento'),
        type: 'DOCUMENT',
        source: 'MANUAL_UPLOAD',
        ownerUserId,
        collectedOn: '2026-02-01',
        observation:
          'Evidência anexada para satisfazer a Invariante F5 (FR-010) antes do fechamento.',
      });
    expect(evidenceResponse.status).toBe(201);
    const linkResponse = await agent
      .post(`/api/v1/evidence/${(evidenceResponse.body as EvidenceBody).id}/links`)
      .set('Origin', appOrigin)
      .send({ subjectType: 'FINDING', subjectId: findingId });
    expect(linkResponse.status).toBe(201);
  }

  describe('POST /findings', () => {
    it('succeeds for a caller holding finding:create and returns the declared Finding shape, status OPEN', async () => {
      const { agent } = await agentWithPermissions(['finding:create', 'finding:view']);
      const finding = await createFindingViaApi(agent);

      expect(finding.id).toBeTruthy();
      expect(finding.code).toMatch(/^FND-\d{4}-\d{4,}$/);
      expect(finding.status).toBe('OPEN');
      expect(finding.severity).toBe('HIGH');
      expect(finding.priority).toBe('HIGH');
      expect(finding.openActionCount).toBe(0);
      expect(finding.evidenceCount).toBe(0);
      expect(finding.closedAt).toBeNull();
    });

    it('refuses a caller lacking finding:create — 403', async () => {
      const { agent } = await agentWithPermissions(['finding:view']);
      const response = await agent
        .post('/api/v1/findings')
        .set('Origin', appOrigin)
        .send(validCreateBody());
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/findings')
        .set('Origin', appOrigin)
        .send(validCreateBody());
      expect(response.status).toBe(401);
      const body = response.body as ProblemBody;
      expect(body.status).toBe(401);
    });

    it('emits a distinct finding.created audit event on success', async () => {
      const { agent } = await agentWithPermissions(['finding:create', 'finding:view']);
      const finding = await createFindingViaApi(agent);

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.created' },
      });
      expect(auditRow).not.toBeNull();
      expect(auditRow?.organizationalUnitId).toBe(orgUnitId);
    });

    it('an orgUnitId outside the caller scope is refused 422 (creation-time scope, no existing record to disclose)', async () => {
      const { agent } = await agentWithPermissions(['finding:create', 'finding:view']);
      const response = await agent
        .post('/api/v1/findings')
        .set('Origin', appOrigin)
        .send(validCreateBody({ orgUnitId: otherOrgUnitId }));
      expect(response.status).toBe(422);
    });

    it('a real out-of-scope orgUnitId and a nonexistent orgUnitId produce the byte-identical 422 message', async () => {
      const { agent } = await agentWithPermissions(['finding:create', 'finding:view']);

      const outOfScopeResponse = await agent
        .post('/api/v1/findings')
        .set('Origin', appOrigin)
        .send(validCreateBody({ orgUnitId: otherOrgUnitId }));
      const nonexistentResponse = await agent
        .post('/api/v1/findings')
        .set('Origin', appOrigin)
        .send(validCreateBody({ orgUnitId: randomUUID() }));

      expect(outOfScopeResponse.status).toBe(422);
      expect(nonexistentResponse.status).toBe(422);
      const outOfScopeBody = outOfScopeResponse.body as ProblemBody;
      const nonexistentBody = nonexistentResponse.body as ProblemBody;
      expect(outOfScopeBody.title).toBe(nonexistentBody.title);
      expect(outOfScopeBody.detail).toBe(nonexistentBody.detail);
    });
  });

  describe('GET /findings', () => {
    it('refuses a caller lacking finding:view — 403, audited as DENIED', async () => {
      const prisma = ctx.app.get(PrismaService);
      const before = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });

      const { agent } = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/findings').set('Origin', appOrigin);
      expect(response.status).toBe(403);

      const after = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });
      expect(after).toBeGreaterThan(before);
    });

    it('lists findings within the caller scope, filterable by severity', async () => {
      const { agent } = await agentWithPermissions(['finding:create', 'finding:view']);
      await createFindingViaApi(agent, { severity: 'CRITICAL', title: 'Achado crítico único' });

      const response = await agent
        .get('/api/v1/findings')
        .query({ severity: 'CRITICAL' })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as FindingPageBody;
      expect(body.items.every((item) => item.severity === 'CRITICAL')).toBe(true);
      expect(body.items.some((item) => item.title === 'Achado crítico único')).toBe(true);
    });

    it('filters by orgUnitId — the risk detail panel’s own read path, no Finding-to-Risk relationship in this phase', async () => {
      const { agent } = await agentWithPermissions(['finding:create', 'finding:view']);
      const finding = await createFindingViaApi(agent, {
        title: uniqueTestMarker('achado-por-unidade'),
      });

      const response = await agent
        .get('/api/v1/findings')
        .query({ orgUnitId })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const ids = (response.body as FindingPageBody).items.map((item) => item.id);
      expect(ids).toContain(finding.id);
    });

    it('SC-010: withoutRemediation lists only OPEN findings with no linked action', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const unremediated = await createFindingViaApi(agent, {
        title: uniqueTestMarker('achado-sem-remediacao'),
      });
      const remediated = await createFindingViaApi(agent, {
        title: uniqueTestMarker('achado-com-remediacao'),
      });
      await agent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'FINDING',
        originId: remediated.id,
        title: 'Corrigir controle',
        responsibleUserId: ownerUserId,
        dueOn: '2035-01-01',
      });

      const response = await agent
        .get('/api/v1/findings')
        .query({ withoutRemediation: 'true' })
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const ids = (response.body as FindingPageBody).items.map((item) => item.id);
      expect(ids).toContain(unremediated.id);
      expect(ids).not.toContain(remediated.id);
    });
  });

  describe('GET /findings/{findingId}', () => {
    it('an out-of-scope finding reads 404, byte-identical to an unknown id', async () => {
      const { agent: ownerAgent } = await agentWithPermissions(
        ['finding:create', 'finding:view'],
        otherOrgUnitId,
      );
      const finding = await createFindingViaApi(ownerAgent, { orgUnitId: otherOrgUnitId });

      const { agent: outsiderAgent } = await agentWithPermissions(['finding:view']);
      const outOfScopeResponse = await outsiderAgent
        .get(`/api/v1/findings/${finding.id}`)
        .set('Origin', appOrigin);
      const unknownResponse = await outsiderAgent
        .get(`/api/v1/findings/${randomUUID()}`)
        .set('Origin', appOrigin);

      expect(outOfScopeResponse.status).toBe(404);
      expect(unknownResponse.status).toBe(404);
      const outOfScopeBody = outOfScopeResponse.body as ProblemBody & { type?: string };
      const unknownBody = unknownResponse.body as ProblemBody & { type?: string };
      expect(outOfScopeBody.title).toBe(unknownBody.title);
      expect(outOfScopeBody.status).toBe(unknownBody.status);
      expect(outOfScopeBody.type).toBe(unknownBody.type);
    });
  });

  describe('PATCH /findings/{findingId}', () => {
    it('updates descriptive fields and severity without touching priority', async () => {
      const { agent } = await agentWithPermissions([
        'finding:create',
        'finding:view',
        'finding:edit',
      ]);
      const finding = await createFindingViaApi(agent);

      const response = await agent
        .patch(`/api/v1/findings/${finding.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Título revisado', severity: 'CRITICAL' });
      expect(response.status).toBe(200);
      const body = response.body as FindingBody;
      expect(body.title).toBe('Título revisado');
      expect(body.severity).toBe('CRITICAL');
      expect(body.priority).toBe('HIGH');
    });

    it('FR-022: a priority-only change emits finding.priority_changed, distinct from finding.updated', async () => {
      const { agent } = await agentWithPermissions([
        'finding:create',
        'finding:view',
        'finding:edit',
      ]);
      const finding = await createFindingViaApi(agent);

      const response = await agent
        .patch(`/api/v1/findings/${finding.id}`)
        .set('Origin', appOrigin)
        .send({ priority: 'URGENT' });
      expect(response.status).toBe(200);
      expect((response.body as FindingBody).priority).toBe('URGENT');
      expect((response.body as FindingBody).severity).toBe('HIGH');

      const prisma = ctx.app.get(PrismaService);
      const priorityEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.priority_changed' },
      });
      expect(priorityEvent).not.toBeNull();
      const newValues = priorityEvent?.newValues as Record<string, unknown> | null;
      expect(newValues?.priority).toBe('URGENT');

      const genericUpdateEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.updated' },
      });
      expect(genericUpdateEvent).toBeNull();
    });

    it('C5/adversarial: a status field is rejected as an unknown property — 400, never a route around closure', async () => {
      const { agent } = await agentWithPermissions([
        'finding:create',
        'finding:view',
        'finding:edit',
      ]);
      const finding = await createFindingViaApi(agent);

      const response = await agent
        .patch(`/api/v1/findings/${finding.id}`)
        .set('Origin', appOrigin)
        .send({ status: 'CLOSED' });
      expect(response.status).toBe(400);

      const unchanged = await agent.get(`/api/v1/findings/${finding.id}`).set('Origin', appOrigin);
      expect((unchanged.body as FindingBody).status).toBe('OPEN');
    });

    it('Phase 6 correction: an archived finding rejects edits with 422, mirroring Evidence’s assertEvidenceEditable', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      await attachEvidenceToFinding(agent, finding.id);
      const closeResponse = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado.' });
      expect(closeResponse.status).toBe(200);
      const archiveResponse = await agent
        .post(`/api/v1/findings/${finding.id}/archive`)
        .set('Origin', appOrigin);
      expect(archiveResponse.status).toBe(200);

      const response = await agent
        .patch(`/api/v1/findings/${finding.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Não deveria funcionar' });
      expect(response.status).toBe(422);
    });

    it('a CLOSED (not yet archived) finding stays editable — post-closure correction is legitimate', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      await attachEvidenceToFinding(agent, finding.id);
      const closeResponse = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado.' });
      expect(closeResponse.status).toBe(200);

      const response = await agent
        .patch(`/api/v1/findings/${finding.id}`)
        .set('Origin', appOrigin)
        .send({ title: 'Correção pós-encerramento' });
      expect(response.status).toBe(200);
      expect((response.body as FindingBody).title).toBe('Correção pós-encerramento');
    });
  });

  describe('POST /findings/{findingId}/close', () => {
    async function findingWithCompletedAction(responsibleUserId: string): Promise<{
      agent: ReturnType<typeof request.agent>;
      finding: FindingBody;
      action: ActionBody;
    }> {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      const actionResponse = await agent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'FINDING',
        originId: finding.id,
        title: 'Implementar segregação de funções',
        responsibleUserId,
        dueOn: '2035-01-01',
      });
      expect(actionResponse.status).toBe(201);
      const action = actionResponse.body as ActionBody;

      await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      const completed = await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'COMPLETED' });
      expect(completed.status).toBe(200);

      await attachEvidenceToFinding(agent, finding.id);

      return { agent, finding, action };
    }

    it('F1/422: closing without a completed linked action and without justification is refused', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(422);
    });

    it('F1: closing without a completed action but WITH a justification succeeds (FR-010: now also requires evidence, attached here)', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      await attachEvidenceToFinding(agent, finding.id);

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Aceito formalmente — risco residual considerado baixo.' });
      expect(response.status).toBe(200);
      const body = response.body as FindingBody;
      expect(body.status).toBe('CLOSED');
      expect(body.closureJustification).toBe(
        'Aceito formalmente — risco residual considerado baixo.',
      );
      expect(body.closedAt).not.toBeNull();
    });

    it('F2/segregation of duties: the responsible user of a COMPLETED linked action may not close it — 403, audited', async () => {
      const { agent: closerAgent, userId: closerUserId } = await agentWithPermissions(
        FULL_LIFECYCLE_PERMISSIONS,
      );
      const { finding } = await findingWithCompletedAction(closerUserId);

      const prisma = ctx.app.get(PrismaService);
      const before = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });

      const response = await closerAgent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(403);

      const after = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });
      expect(after).toBeGreaterThan(before);
      const deniedEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.close_denied' },
      });
      expect(deniedEvent).not.toBeNull();
      expect(deniedEvent?.outcome).toBe('DENIED');

      const stillOpen = await closerAgent
        .get(`/api/v1/findings/${finding.id}`)
        .set('Origin', appOrigin);
      expect((stillOpen.body as FindingBody).status).toBe('OPEN');
    });

    it('F2: a DIFFERENT user, not responsible for the completed action, CAN close it', async () => {
      const { userId: remediatorUserId } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const { finding } = await findingWithCompletedAction(remediatorUserId);

      const { agent: closerAgent } = await agentWithPermissions(['finding:view', 'finding:close']);
      const response = await closerAgent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(200);
      expect((response.body as FindingBody).status).toBe('CLOSED');
    });

    it('being responsible for an action that is NOT completed does not block closing (the rule is about completed, self-attested work)', async () => {
      const { agent, userId } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      const actionResponse = await agent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'FINDING',
        originId: finding.id,
        title: 'Ação ainda em aberto',
        responsibleUserId: userId,
        dueOn: '2035-01-01',
      });
      expect(actionResponse.status).toBe(201);
      await attachEvidenceToFinding(agent, finding.id);

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado com ação de remediação ainda em aberto, por decisão.' });
      expect(response.status).toBe(200);
      expect((response.body as FindingBody).status).toBe('CLOSED');
    });

    it('F3: completing every linked action does NOT close the finding on its own', async () => {
      const { userId: remediatorUserId } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const { agent, finding } = await findingWithCompletedAction(remediatorUserId);

      const response = await agent.get(`/api/v1/findings/${finding.id}`).set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect((response.body as FindingBody).status).toBe('OPEN');
      expect((response.body as FindingBody).openActionCount).toBe(0);
    });

    it('closing twice is refused 422 the second time (already CLOSED is not a legal source state)', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      await attachEvidenceToFinding(agent, finding.id);
      const first = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Primeiro encerramento.' });
      expect(first.status).toBe(200);

      const second = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Segunda tentativa.' });
      expect(second.status).toBe(422);
    });

    it('refuses a caller lacking finding:close — 403', async () => {
      const { agent } = await agentWithPermissions([
        'finding:create',
        'finding:view',
        'finding:edit',
      ]);
      const finding = await createFindingViaApi(agent);

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Sem permissão para encerrar.' });
      expect(response.status).toBe(403);
    });

    it('emits a distinct finding.closed audit event', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      await attachEvidenceToFinding(agent, finding.id);
      await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado.' });

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.closed' },
      });
      expect(auditRow).not.toBeNull();
    });
  });

  describe('closeFinding — Invariant F5 (FR-010, SC-003, additive to F1)', () => {
    it('T053: a finding that satisfies F1 (justification, no completed action) but has NO evidence at all is refused 422 — exactly the case that closed before this fase', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Aceito formalmente — risco residual considerado baixo.' });
      expect(response.status).toBe(422);

      const stillOpen = await agent.get(`/api/v1/findings/${finding.id}`).set('Origin', appOrigin);
      expect((stillOpen.body as FindingBody).status).toBe('OPEN');
    });

    it('T054: an evidence archived AFTER being linked still sustains closure — only the ABSENCE of an active link refuses (spec.md edge case)', async () => {
      const { agent } = await agentWithPermissions([
        ...FULL_LIFECYCLE_PERMISSIONS,
        'evidence:administer',
      ]);
      const finding = await createFindingViaApi(agent);

      const evidenceResponse = await agent
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send({
          orgUnitId,
          title: uniqueTestMarker('evidencia-arquivada'),
          type: 'DOCUMENT',
          source: 'MANUAL_UPLOAD',
          ownerUserId,
          collectedOn: '2026-02-01',
          observation: 'x',
        });
      expect(evidenceResponse.status).toBe(201);
      const evidence = evidenceResponse.body as EvidenceBody;
      const linkResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'FINDING', subjectId: finding.id });
      expect(linkResponse.status).toBe(201);

      const archiveResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/archive`)
        .set('Origin', appOrigin);
      expect(archiveResponse.status).toBe(200);

      const closeResponse = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado com evidência arquivada, mas o vínculo ainda ativo.' });
      expect(closeResponse.status).toBe(200);
      expect((closeResponse.body as FindingBody).status).toBe('CLOSED');
    });

    it('T055: reopening and closing again re-evaluates F5 — a finding whose only evidence link was genuinely UNLINKED (not archived) is refused on the second close', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);

      const evidenceResponse = await agent
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send({
          orgUnitId,
          title: uniqueTestMarker('evidencia-desvinculada'),
          type: 'DOCUMENT',
          source: 'MANUAL_UPLOAD',
          ownerUserId,
          collectedOn: '2026-02-01',
          observation: 'x',
        });
      const evidence = evidenceResponse.body as EvidenceBody;
      const linkResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'FINDING', subjectId: finding.id });
      expect(linkResponse.status).toBe(201);
      const link = linkResponse.body as { id: string };

      const firstClose = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Primeiro encerramento, com evidência.' });
      expect(firstClose.status).toBe(200);

      const reopenResponse = await agent
        .post(`/api/v1/findings/${finding.id}/reopen`)
        .set('Origin', appOrigin)
        .send({ reason: 'Reabertura para novo teste.' });
      expect(reopenResponse.status).toBe(200);

      const unlinkResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links/${link.id}/unlink`)
        .set('Origin', appOrigin);
      expect(unlinkResponse.status).toBe(200);

      const secondClose = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Segundo encerramento, sem evidência ativa.' });
      expect(secondClose.status).toBe(422);
    });
  });

  describe('POST /findings/{findingId}/start-remediation (SC-002, FR-009)', () => {
    it('moves an OPEN finding to IN_REMEDIATION and emits finding.remediation_started with previous/new status', async () => {
      const { agent } = await agentWithPermissions([
        'finding:create',
        'finding:view',
        'finding:remediate',
      ]);
      const finding = await createFindingViaApi(agent);
      expect(finding.status).toBe('OPEN');

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/start-remediation`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect((response.body as FindingBody).status).toBe('IN_REMEDIATION');

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.remediation_started' },
      });
      expect(event).not.toBeNull();
      const previousValues = event?.previousValues as Record<string, unknown> | null;
      const newValues = event?.newValues as Record<string, unknown> | null;
      expect(previousValues?.status).toBe('OPEN');
      expect(newValues?.status).toBe('IN_REMEDIATION');
    });

    it('calling it a second time on the same (now IN_REMEDIATION) finding is refused 422 — the edge only fires from OPEN', async () => {
      const { agent } = await agentWithPermissions([
        'finding:create',
        'finding:view',
        'finding:remediate',
      ]);
      const finding = await createFindingViaApi(agent);
      const first = await agent
        .post(`/api/v1/findings/${finding.id}/start-remediation`)
        .set('Origin', appOrigin);
      expect(first.status).toBe(200);

      const second = await agent
        .post(`/api/v1/findings/${finding.id}/start-remediation`)
        .set('Origin', appOrigin);
      expect(second.status).toBe(422);
    });

    it('a CLOSED finding is refused 422 — reopening is a different, dedicated operation', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      await attachEvidenceToFinding(agent, finding.id);
      const closeResponse = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado.' });
      expect(closeResponse.status).toBe(200);

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/start-remediation`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(422);
    });

    it('refuses a caller lacking finding:remediate — 403', async () => {
      const { agent } = await agentWithPermissions(['finding:create', 'finding:view']);
      const finding = await createFindingViaApi(agent);

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/start-remediation`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('an out-of-scope finding reads 404, byte-identical to an unknown id', async () => {
      const { agent: ownerAgent } = await agentWithPermissions(
        ['finding:create', 'finding:view'],
        otherOrgUnitId,
      );
      const finding = await createFindingViaApi(ownerAgent, { orgUnitId: otherOrgUnitId });

      const { agent: outsiderAgent } = await agentWithPermissions(['finding:remediate']);
      const outOfScopeResponse = await outsiderAgent
        .post(`/api/v1/findings/${finding.id}/start-remediation`)
        .set('Origin', appOrigin);
      const unknownResponse = await outsiderAgent
        .post(`/api/v1/findings/${randomUUID()}/start-remediation`)
        .set('Origin', appOrigin);
      expect(outOfScopeResponse.status).toBe(404);
      expect(unknownResponse.status).toBe(404);
    });
  });

  describe('SC-004: segregation of duties exercised through the real remediation producer', () => {
    it('a finding moved to IN_REMEDIATION via start-remediation, remediated by A, cannot be closed by A — 403, audited; B closes it successfully', async () => {
      const { agent, userId: remediatorUserId } = await agentWithPermissions(
        FULL_LIFECYCLE_PERMISSIONS,
      );
      const finding = await createFindingViaApi(agent);

      const startResponse = await agent
        .post(`/api/v1/findings/${finding.id}/start-remediation`)
        .set('Origin', appOrigin);
      expect(startResponse.status).toBe(200);
      expect((startResponse.body as FindingBody).status).toBe('IN_REMEDIATION');

      const actionResponse = await agent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'FINDING',
        originId: finding.id,
        title: 'Remediar não conformidade',
        responsibleUserId: remediatorUserId,
        dueOn: '2035-01-01',
      });
      const action = actionResponse.body as ActionBody;
      await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'COMPLETED' });
      await attachEvidenceToFinding(agent, finding.id);

      const prisma = ctx.app.get(PrismaService);
      const before = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });

      const denied = await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({});
      expect(denied.status).toBe(403);

      const after = await prisma.client.auditEvent.count({ where: { outcome: 'DENIED' } });
      expect(after).toBeGreaterThan(before);

      const { agent: otherAgent } = await agentWithPermissions(['finding:view', 'finding:close']);
      const accepted = await otherAgent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado por outra pessoa, remediação já verificada.' });
      expect(accepted.status).toBe(200);
      expect((accepted.body as FindingBody).status).toBe('CLOSED');
    });
  });

  describe('POST /findings/{findingId}/reopen', () => {
    it('reopens a closed finding, requires a reason, and preserves the previous closure in the audit trail', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      await attachEvidenceToFinding(agent, finding.id);
      await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado inicialmente.' });

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/reopen`)
        .set('Origin', appOrigin)
        .send({ reason: 'Remediação considerada insuficiente após revisão.' });
      expect(response.status).toBe(200);
      const body = response.body as FindingBody;
      expect(body.status).toBe('IN_REMEDIATION');
      expect(body.closedAt).toBeNull();
      expect(body.closureJustification).toBeNull();

      const prisma = ctx.app.get(PrismaService);
      const reopenedEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.reopened' },
      });
      expect(reopenedEvent).not.toBeNull();
      const previousValues = reopenedEvent?.previousValues as Record<string, unknown> | null;
      expect(previousValues?.closureJustification).toBe('Encerrado inicialmente.');
      const newValues = reopenedEvent?.newValues as Record<string, unknown> | null;
      expect(newValues?.reopenReason).toBe('Remediação considerada insuficiente após revisão.');

      const closedEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.closed' },
      });
      expect(closedEvent).not.toBeNull();
    });

    it('422/adversarial: reopening without a reason is refused', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      await attachEvidenceToFinding(agent, finding.id);
      await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado.' });

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/reopen`)
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(400);
    });

    it('422/adversarial: reopening a finding that was never closed is refused', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/reopen`)
        .set('Origin', appOrigin)
        .send({ reason: 'Tentativa indevida.' });
      expect(response.status).toBe(422);
    });

    it('refuses a caller lacking finding:close — 403', async () => {
      const { agent: closerAgent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(closerAgent);
      await attachEvidenceToFinding(closerAgent, finding.id);
      await closerAgent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado.' });

      const { agent: viewerAgent } = await agentWithPermissions(['finding:view']);
      const response = await viewerAgent
        .post(`/api/v1/findings/${finding.id}/reopen`)
        .set('Origin', appOrigin)
        .send({ reason: 'Sem permissão.' });
      expect(response.status).toBe(403);
    });
  });

  describe('POST /findings/{findingId}/archive', () => {
    it('F4/422: archiving a finding that is not CLOSED is refused', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/archive`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(422);
    });

    it('archives a CLOSED finding and emits finding.archived', async () => {
      const { agent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);
      await attachEvidenceToFinding(agent, finding.id);
      await agent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado.' });

      const response = await agent
        .post(`/api/v1/findings/${finding.id}/archive`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect((response.body as FindingBody).status).toBe('ARCHIVED');

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.archived' },
      });
      expect(auditRow).not.toBeNull();
    });

    it('refuses a caller lacking finding:administer — 403', async () => {
      const { agent: closerAgent } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(closerAgent);
      await attachEvidenceToFinding(closerAgent, finding.id);
      await closerAgent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado.' });

      const { agent: viewerAgent } = await agentWithPermissions(['finding:view']);
      const response = await viewerAgent
        .post(`/api/v1/findings/${finding.id}/archive`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });
  });

  describe('Evidence and Action integrity for Finding (T072, FR-023)', () => {
    it('evidence can be linked to a finding, and evidenceCount reflects it', async () => {
      const { agent, userId } = await agentWithPermissions([
        'finding:create',
        'finding:view',
        'evidence:create',
        'evidence:view',
        'evidence:link',
      ]);
      const finding = await createFindingViaApi(agent);

      const evidenceResponse = await agent.post('/api/v1/evidence').set('Origin', appOrigin).send({
        orgUnitId,
        title: 'Evidência da não conformidade',
        type: 'DOCUMENT',
        source: 'MANUAL_UPLOAD',
        ownerUserId: userId,
        collectedOn: '2026-02-01',
        observation: 'Registro do procedimento não seguido.',
      });
      expect(evidenceResponse.status).toBe(201);
      const evidence = evidenceResponse.body as EvidenceBody;

      const linkResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'FINDING', subjectId: finding.id });
      expect(linkResponse.status).toBe(201);
      const linkBody = linkResponse.body as { subjectType: string; subjectLabel?: string };
      expect(linkBody.subjectType).toBe('FINDING');
      expect(linkBody.subjectLabel).toContain(finding.code);

      const findingAfter = await agent
        .get(`/api/v1/findings/${finding.id}`)
        .set('Origin', appOrigin);
      expect((findingAfter.body as FindingBody).evidenceCount).toBe(1);
    });

    it('evidence linked to a finding outside the caller scope is refused 404 — the subject side is checked independently', async () => {
      const { agent: ownerAgent } = await agentWithPermissions(
        ['finding:create', 'finding:view'],
        otherOrgUnitId,
      );
      const finding = await createFindingViaApi(ownerAgent, { orgUnitId: otherOrgUnitId });

      const { agent: outsiderAgent, userId: outsiderUserId } = await agentWithPermissions([
        'evidence:create',
        'evidence:view',
        'evidence:link',
        'finding:view',
      ]);
      const evidenceResponse = await outsiderAgent
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send({
          orgUnitId,
          title: 'Evidência do outsider',
          type: 'DOCUMENT',
          source: 'MANUAL_UPLOAD',
          ownerUserId: outsiderUserId,
          collectedOn: '2026-02-01',
          observation: 'x',
        });
      expect(evidenceResponse.status).toBe(201);

      const response = await outsiderAgent
        .post(`/api/v1/evidence/${(evidenceResponse.body as EvidenceBody).id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'FINDING', subjectId: finding.id });
      expect(response.status).toBe(404);
    });

    it('an action can be originated from a finding, and openActionCount reflects it', async () => {
      const { agent } = await agentWithPermissions([
        'finding:create',
        'finding:view',
        'finding:edit',
        'action:create',
        'action:view',
      ]);
      const finding = await createFindingViaApi(agent);

      const response = await agent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'FINDING',
        originId: finding.id,
        title: 'Corrigir a não conformidade',
        responsibleUserId: ownerUserId,
        dueOn: '2035-01-01',
      });
      expect(response.status).toBe(201);
      const action = response.body as ActionBody;
      expect(action.originType).toBe('FINDING');
      expect(action.originId).toBe(finding.id);

      const findingAfter = await agent
        .get(`/api/v1/findings/${finding.id}`)
        .set('Origin', appOrigin);
      expect((findingAfter.body as FindingBody).openActionCount).toBe(1);
    });

    it('originating an action from a finding requires finding:edit, not just enum validity — a viewer without finding:edit is refused 404', async () => {
      const { agent: ownerAgent } = await agentWithPermissions(['finding:create', 'finding:view']);
      const finding = await createFindingViaApi(ownerAgent);

      const { agent: viewerAgent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'finding:view',
      ]);
      const response = await viewerAgent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'FINDING',
        originId: finding.id,
        title: 'Ação sem autoridade sobre a origem',
        responsibleUserId: ownerUserId,
        dueOn: '2035-01-01',
      });
      expect(response.status).toBe(404);
    });

    it('an action originated from a finding outside the caller scope is refused 404, byte-identical to unknown', async () => {
      const { agent: ownerAgent } = await agentWithPermissions(
        ['finding:create', 'finding:view', 'finding:edit'],
        otherOrgUnitId,
      );
      const finding = await createFindingViaApi(ownerAgent, { orgUnitId: otherOrgUnitId });

      const { agent: outsiderAgent } = await agentWithPermissions([
        'action:create',
        'action:view',
        'finding:view',
        'finding:edit',
      ]);
      const outOfScope = await outsiderAgent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'FINDING',
        originId: finding.id,
        title: 'x',
        responsibleUserId: ownerUserId,
        dueOn: '2035-01-01',
      });
      const unknown = await outsiderAgent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'FINDING',
        originId: randomUUID(),
        title: 'x',
        responsibleUserId: ownerUserId,
        dueOn: '2035-01-01',
      });
      expect(outOfScope.status).toBe(404);
      expect(unknown.status).toBe(404);
    });
  });

  describe('SC-003: closed finding provenance is reconstructable via the API', () => {
    it('reconstructs opening -> evidence -> action -> completion -> closure with actor and date at each step', async () => {
      const { agent, userId } = await agentWithPermissions(FULL_LIFECYCLE_PERMISSIONS);
      const finding = await createFindingViaApi(agent);

      const evidenceResponse = await agent.post('/api/v1/evidence').set('Origin', appOrigin).send({
        orgUnitId,
        title: 'Prova da não conformidade',
        type: 'DOCUMENT',
        source: 'MANUAL_UPLOAD',
        ownerUserId: userId,
        collectedOn: '2026-02-01',
        observation: 'x',
      });
      const evidence = evidenceResponse.body as EvidenceBody;
      await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'FINDING', subjectId: finding.id });

      const actionResponse = await agent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'FINDING',
        originId: finding.id,
        title: 'Remediar',
        responsibleUserId: userId,
        dueOn: '2035-01-01',
      });
      const action = actionResponse.body as ActionBody;
      await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' });
      await agent
        .post(`/api/v1/actions/${action.id}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'COMPLETED' });

      const { agent: closerAgent } = await agentWithPermissions(['finding:view', 'finding:close']);
      const closed = await closerAgent
        .post(`/api/v1/findings/${finding.id}/close`)
        .set('Origin', appOrigin)
        .send({});
      expect(closed.status).toBe(200);

      const prisma = ctx.app.get(PrismaService);
      const createdEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.created' },
      });
      const closedEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: finding.id, action: 'finding.closed' },
      });
      expect(createdEvent).not.toBeNull();
      expect(closedEvent).not.toBeNull();
      expect(createdEvent?.actorUserId).not.toBe(closedEvent?.actorUserId);
      expect(createdEvent?.occurredAt.getTime()).toBeLessThanOrEqual(
        closedEvent!.occurredAt.getTime(),
      );
    });
  });
});
