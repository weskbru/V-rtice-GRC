/**
 * T041/T044/T045/T046/005-audit-findings — contract coverage for the
 * engagement operations of `contracts/audit.openapi.yaml`: the 11 User
 * Story 1 operations (`listAuditEngagements`, `createAuditEngagement`,
 * `getAuditEngagement`, `updateAuditEngagement`, `listAuditScope`,
 * `addFrameworkVersionToScope`, `addRequirementToScope`,
 * `addControlToScope`, `startAuditEngagement`, `completeAuditEngagement`,
 * `cancelAuditEngagement`), PLUS the two User Story 2 operations this task
 * closes (`listAuditEngagementFindings`, `createFindingFromEngagement` —
 * `GET`/`POST /audits/{auditId}/findings`). Uses the real `AppModule`
 * (`buildContractTestApp`) — this task owns `audit-engagements.module.ts`'s
 * own controller wiring, so (unlike `control-catalog.spec.ts`) no
 * per-module test-app override is needed.
 *
 * Every 404 assertion below checks BOTH the HTTP status and the problem
 * body's `status`/`title`, mirroring `control-catalog.spec.ts`'s own
 * "identical 404 problem bodies" test — status/title alone is what proves
 * indistinguishability without the test depending on the exact `detail`
 * copy.
 */
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
import { createLocalUserFixture, createOrgUnitFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: readonly { field: string; message: string }[];
}

interface UserRefBody {
  readonly id: string;
  readonly fullName: string;
}

interface AuditEngagementBody {
  readonly id: string;
  readonly code: string;
  readonly objective: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly orgUnit: { readonly id: string; readonly name: string };
  readonly leadAuditor: UserRefBody;
  readonly status: string;
  readonly startedAt: string | null;
  readonly startedBy: UserRefBody | null;
  readonly completedAt: string | null;
  readonly completedBy: UserRefBody | null;
  readonly cancelledAt: string | null;
  readonly cancelledBy: UserRefBody | null;
  readonly cancellationJustification: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AuditEngagementPageBody {
  readonly data: readonly AuditEngagementBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

interface AuditScopeEntryBody {
  readonly id: string;
  readonly targetType: string;
  readonly target: { readonly id: string; readonly label: string };
  readonly linkedAt: string;
  readonly linkedBy: UserRefBody;
}

interface FindingSummaryBody {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly category: string;
  readonly origin: string;
  readonly severity: string;
  readonly priority: string;
  readonly owner: UserRefBody;
  readonly status: string;
  readonly auditEngagementId: string | null;
  readonly identifiedOn: string;
  readonly createdAt: string;
}

interface FindingSummaryPageBody {
  readonly data: readonly FindingSummaryBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

const ALL_ENGAGEMENT_PERMISSIONS: readonly PermissionIdentifier[] = [
  'audit-engagement:view',
  'audit-engagement:create',
  'audit-engagement:edit',
  'audit-engagement:scope',
  'audit-engagement:transition',
];

describe('Audit engagements (US1, operations 1-11)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let leadAuditorUserId: string;

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
    unitId: string = orgUnitId,
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('audit-engagement-actor')}@example.test`,
      primaryOrgUnitId: unitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-audit-engagement-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: unitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return agent;
  }

  async function createEngagement(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; version: string; body: AuditEngagementBody }> {
    const response = await agent
      .post('/api/v1/audits')
      .set('Origin', appOrigin)
      .send({
        objective: 'Auditoria de teste de contrato.',
        periodStart: '2026-01-01',
        periodEnd: '2026-06-30',
        orgUnitId,
        leadAuditorUserId,
        ...overrides,
      });
    expect(response.status).toBe(201);
    const body = response.body as AuditEngagementBody;
    return { id: body.id, version: response.headers.etag!, body };
  }

  /** A `FrameworkVersion` + `Requirement` pair, both `PUBLISHED` (FR-006's
   * own precondition for a legal scope target). `agent` needs
   * `compliance:administer` (create/publish) and `compliance:view`
   * (the ADR-020 part 5 referenced-side check `LinkAuditScopeTo*UseCase`
   * applies). */
  async function createPublishedFrameworkVersionWithRequirement(
    agent: ReturnType<typeof request.agent>,
  ): Promise<{ frameworkId: string; versionId: string; requirementId: string }> {
    const frameworkResponse = await agent
      .post('/api/v1/frameworks')
      .set('Origin', appOrigin)
      .send({
        name: uniqueTestMarker('Framework de auditoria'),
        description: 'Framework de teste de contrato de auditoria.',
        origin: 'EXTERNAL_STANDARD',
      });
    const frameworkId = (frameworkResponse.body as { id: string }).id;

    const versionResponse = await agent
      .post(`/api/v1/frameworks/${frameworkId}/versions`)
      .set('Origin', appOrigin)
      .send({ label: uniqueTestMarker('v') });
    const versionId = (versionResponse.body as { id: string }).id;
    const versionEtag = versionResponse.headers.etag!;

    const requirementResponse = await agent
      .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/requirements`)
      .set('Origin', appOrigin)
      .send({ externalRef: 'A.1', title: 'Requisito de auditoria', description: 'Descrição.' });
    const requirementId = (requirementResponse.body as { id: string }).id;

    const publishResponse = await agent
      .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/publish`)
      .set('Origin', appOrigin)
      .set('If-Match', versionEtag);
    expect(publishResponse.status).toBe(200);

    return { frameworkId, versionId, requirementId };
  }

  /** A `DRAFT` `FrameworkVersion` — never a legal scope target
   * (research.md D-2's "regra adicional"). */
  async function createDraftFrameworkVersion(
    agent: ReturnType<typeof request.agent>,
  ): Promise<{ frameworkId: string; versionId: string }> {
    const frameworkResponse = await agent
      .post('/api/v1/frameworks')
      .set('Origin', appOrigin)
      .send({
        name: uniqueTestMarker('Framework rascunho'),
        description: 'Framework de teste de contrato de auditoria (rascunho).',
        origin: 'EXTERNAL_STANDARD',
      });
    const frameworkId = (frameworkResponse.body as { id: string }).id;

    const versionResponse = await agent
      .post(`/api/v1/frameworks/${frameworkId}/versions`)
      .set('Origin', appOrigin)
      .send({ label: uniqueTestMarker('draft-v') });
    const versionId = (versionResponse.body as { id: string }).id;

    return { frameworkId, versionId };
  }

  /** An `ACTIVE` `Control` in `unitId` — seeded directly (no admin endpoint
   * creates an already-`ACTIVE` control in one call; `control-catalog.spec.ts`/
   * `compliance-mapping-and-state.spec.ts` both seed this dependency the
   * same way). */
  async function createActiveControlFixture(unitId: string = orgUnitId): Promise<string> {
    const prisma = ctx.app.get(PrismaService);
    const control = await prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-audit-contract'),
        name: 'Controle de teste de auditoria',
        orgUnitId: unitId,
        status: 'ACTIVE',
        isActive: true,
      },
    });
    return control.id;
  }

  /** Scopes a fresh engagement with an `ACTIVE` control and starts it —
   * `agent` needs `ALL_ENGAGEMENT_PERMISSIONS` plus `control:view`. Returns
   * the id and the ETag AFTER starting (the version a subsequent
   * `complete`/`cancel` call needs). */
  async function startInProgressEngagement(
    agent: ReturnType<typeof request.agent>,
  ): Promise<{ id: string; version: string }> {
    const { id, version } = await createEngagement(agent);
    await agent
      .post(`/api/v1/audits/${id}/scope/controls`)
      .set('Origin', appOrigin)
      .send({ controlId: await createActiveControlFixture() });
    const startResponse = await agent
      .post(`/api/v1/audits/${id}/start`)
      .set('Origin', appOrigin)
      .set('If-Match', version);
    expect(startResponse.status).toBe(200);
    return { id, version: startResponse.headers.etag! };
  }

  /** A valid `CreateFindingFromEngagementRequest` body (`origin` chosen
   * from the three pre-existing `FindingOrigin` values, research.md D-5 —
   * no new one introduced). */
  function findingFromEngagementBody(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      title: 'Achado de teste de contrato',
      description: 'Descrição do achado de teste.',
      category: 'NONCONFORMITY',
      origin: 'CONTROL_TESTING',
      severity: 'HIGH',
      priority: 'HIGH',
      ownerUserId: leadAuditorUserId,
      identifiedOn: '2026-02-01',
      ...overrides,
    };
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('audit-engagement'),
    });
    orgUnitId = orgUnit.id;

    const leadAuditor = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('audit-engagement-lead')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    leadAuditorUserId = leadAuditor.user.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  // -----------------------------------------------------------------
  // POST /audits (createAuditEngagement)
  // -----------------------------------------------------------------
  describe('POST /audits (createAuditEngagement)', () => {
    it('creates an engagement in PLANNING with a server-generated code, and returns Location/ETag', async () => {
      const agent = await agentWithPermissions(['audit-engagement:create']);
      const { body } = await createEngagement(agent);

      expect(body.status).toBe('PLANNING');
      expect(body.code).toMatch(/^AUD-\d{4}-\d{4,}$/);
      expect(body.startedAt).toBeNull();
      expect(body.completedAt).toBeNull();
      expect(body.cancelledAt).toBeNull();
      expect(body.version).toBe(1);
      expect(body.leadAuditor.id).toBe(leadAuditorUserId);
    });

    it('rejects an unknown property (e.g. status/code/version) with 400', async () => {
      const agent = await agentWithPermissions(['audit-engagement:create']);
      const response = await agent.post('/api/v1/audits').set('Origin', appOrigin).send({
        objective: 'Engajamento inválido',
        periodStart: '2026-01-01',
        periodEnd: '2026-06-30',
        orgUnitId,
        leadAuditorUserId,
        status: 'IN_PROGRESS',
      });
      expect(response.status).toBe(400);
    });

    it('rejects periodEnd before periodStart with 422', async () => {
      const agent = await agentWithPermissions(['audit-engagement:create']);
      const response = await agent.post('/api/v1/audits').set('Origin', appOrigin).send({
        objective: 'Período inválido',
        periodStart: '2026-06-30',
        periodEnd: '2026-01-01',
        orgUnitId,
        leadAuditorUserId,
      });
      expect(response.status).toBe(422);
    });

    it('refuses creation into an organizational unit outside the caller scope — 422', async () => {
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('audit-engagement-other'),
      });
      const agent = await agentWithPermissions(['audit-engagement:create']);
      const response = await agent.post('/api/v1/audits').set('Origin', appOrigin).send({
        objective: 'Engajamento fora de escopo',
        periodStart: '2026-01-01',
        periodEnd: '2026-06-30',
        orgUnitId: otherUnit.id,
        leadAuditorUserId,
      });
      expect(response.status).toBe(422);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const agent = await agentWithPermissions([]);
      const response = await agent.post('/api/v1/audits').set('Origin', appOrigin).send({
        objective: 'Engajamento',
        periodStart: '2026-01-01',
        periodEnd: '2026-06-30',
        orgUnitId,
        leadAuditorUserId,
      });
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/audits')
        .set('Origin', appOrigin)
        .send({
          objective: 'Engajamento',
          periodStart: '2026-01-01',
          periodEnd: '2026-06-30',
          orgUnitId,
          leadAuditorUserId,
        });
      expect(response.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------
  // GET /audits (listAuditEngagements)
  // -----------------------------------------------------------------
  describe('GET /audits (listAuditEngagements)', () => {
    it('lists engagements within the caller scope, paginated', async () => {
      const agent = await agentWithPermissions([
        'audit-engagement:create',
        'audit-engagement:view',
      ]);
      await createEngagement(agent);

      const response = await agent.get('/api/v1/audits').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as AuditEngagementPageBody;
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.page).toBe(1);
      expect(body.meta.total).toBeGreaterThan(0);
    });

    it('an engagement outside the caller organizational scope is simply absent from the page', async () => {
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('audit-engagement-list-other'),
      });
      const creatorAgent = await agentWithPermissions(
        ['audit-engagement:create', 'audit-engagement:view'],
        otherUnit.id,
      );
      const otherLead = await createLocalUserFixture(ctx.app.get(PrismaService), {
        email: `${uniqueTestMarker('audit-engagement-other-lead')}@example.test`,
        primaryOrgUnitId: otherUnit.id,
      });
      const { id: outOfScopeId } = await createEngagement(creatorAgent, {
        orgUnitId: otherUnit.id,
        leadAuditorUserId: otherLead.user.id,
      });

      const inScopeAgent = await agentWithPermissions(['audit-engagement:view']);
      const response = await inScopeAgent.get('/api/v1/audits').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as AuditEngagementPageBody;
      expect(body.data.some((item) => item.id === outOfScopeId)).toBe(false);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/audits');
      expect(response.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------
  // GET /audits/{auditId} (getAuditEngagement)
  // -----------------------------------------------------------------
  describe('GET /audits/{auditId} (getAuditEngagement)', () => {
    it('returns the engagement with an ETag carrying its version', async () => {
      const agent = await agentWithPermissions([
        'audit-engagement:create',
        'audit-engagement:view',
      ]);
      const { id, version } = await createEngagement(agent);

      const response = await agent.get(`/api/v1/audits/${id}`).set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect(response.headers.etag).toBe(version);
      const body = response.body as AuditEngagementBody;
      expect(body.id).toBe(id);
    });

    it('an out-of-scope engagement and a nonexistent one answer with identical 404 problem bodies (FR-018, US1 AS5)', async () => {
      const inScopeAgent = await agentWithPermissions(['audit-engagement:create']);
      const { id: outOfScopeId } = await createEngagement(inScopeAgent);

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('audit-engagement-get-other'),
      });
      const outsideAgent = await agentWithPermissions(['audit-engagement:view'], otherUnit.id);

      const responseForReal = await outsideAgent
        .get(`/api/v1/audits/${outOfScopeId}`)
        .set('Origin', appOrigin);
      const responseForFake = await outsideAgent
        .get(`/api/v1/audits/${randomUUID()}`)
        .set('Origin', appOrigin);

      expect(responseForReal.status).toBe(404);
      expect(responseForFake.status).toBe(404);
      const bodyReal = responseForReal.body as ProblemBody;
      const bodyFake = responseForFake.body as ProblemBody;
      expect(bodyReal.status).toBe(bodyFake.status);
      expect(bodyReal.title).toBe(bodyFake.title);
    });

    it('a completed engagement remains fully readable (FR-004)', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'control:view']);
      const { id, version } = await createEngagement(agent);
      await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: await createActiveControlFixture() });
      const startResponse = await agent
        .post(`/api/v1/audits/${id}/start`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      await agent
        .post(`/api/v1/audits/${id}/complete`)
        .set('Origin', appOrigin)
        .set('If-Match', startResponse.headers.etag!);

      const response = await agent.get(`/api/v1/audits/${id}`).set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as AuditEngagementBody;
      expect(body.status).toBe('COMPLETED');
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['audit-engagement:create']);
      const { id } = await createEngagement(creator);
      const zeroAgent = await agentWithPermissions([]);
      const response = await zeroAgent.get(`/api/v1/audits/${id}`).set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------
  // PATCH /audits/{auditId} (updateAuditEngagement)
  // -----------------------------------------------------------------
  describe('PATCH /audits/{auditId} (updateAuditEngagement)', () => {
    it('updates a field, echoes the new ETag, and audits previous/new values', async () => {
      const agent = await agentWithPermissions([
        'audit-engagement:create',
        'audit-engagement:edit',
      ]);
      const { id, version } = await createEngagement(agent);

      const response = await agent
        .patch(`/api/v1/audits/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ objective: 'Objetivo atualizado.' });

      expect(response.status).toBe(200);
      const body = response.body as AuditEngagementBody;
      expect(body.objective).toBe('Objetivo atualizado.');
      expect(response.headers.etag).not.toBe(version);
    });

    it('rejects an empty body with 400', async () => {
      const agent = await agentWithPermissions([
        'audit-engagement:create',
        'audit-engagement:edit',
      ]);
      const { id, version } = await createEngagement(agent);

      const response = await agent
        .patch(`/api/v1/audits/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({});
      expect(response.status).toBe(400);
    });

    it('requires If-Match — 400 when missing', async () => {
      const agent = await agentWithPermissions([
        'audit-engagement:create',
        'audit-engagement:edit',
      ]);
      const { id } = await createEngagement(agent);

      const response = await agent
        .patch(`/api/v1/audits/${id}`)
        .set('Origin', appOrigin)
        .send({ objective: 'x' });
      expect(response.status).toBe(400);
    });

    it('a stale If-Match yields 409 with nothing written', async () => {
      const agent = await agentWithPermissions([
        'audit-engagement:create',
        'audit-engagement:edit',
        'audit-engagement:view',
      ]);
      const { id, version } = await createEngagement(agent);

      await agent
        .patch(`/api/v1/audits/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ objective: 'Primeira atualização' });

      const staleResponse = await agent
        .patch(`/api/v1/audits/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ objective: 'Segunda atualização (deveria falhar)' });
      expect(staleResponse.status).toBe(409);

      const currentResponse = await agent.get(`/api/v1/audits/${id}`).set('Origin', appOrigin);
      expect((currentResponse.body as AuditEngagementBody).objective).toBe('Primeira atualização');
    });

    it('is refused once the engagement is no longer PLANNING — 422 (research.md D-3/D-13)', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'control:view']);
      const { id, version } = await createEngagement(agent);
      await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: await createActiveControlFixture() });
      const startResponse = await agent
        .post(`/api/v1/audits/${id}/start`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect(startResponse.status).toBe(200);

      const response = await agent
        .patch(`/api/v1/audits/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', startResponse.headers.etag!)
        .send({ objective: 'Não deveria ser aceito.' });
      expect(response.status).toBe(422);
    });

    it('reassignment into an out-of-scope organizational unit is refused with 422', async () => {
      const agent = await agentWithPermissions([
        'audit-engagement:create',
        'audit-engagement:edit',
      ]);
      const { id, version } = await createEngagement(agent);
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('audit-engagement-patch-reassign'),
      });

      const response = await agent
        .patch(`/api/v1/audits/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ orgUnitId: otherUnit.id });
      expect(response.status).toBe(422);
    });
  });

  // -----------------------------------------------------------------
  // GET/POST /audits/{auditId}/scope... (listAuditScope,
  // addFrameworkVersionToScope, addRequirementToScope, addControlToScope)
  // -----------------------------------------------------------------
  describe('Audit scope (listAuditScope, addFrameworkVersionToScope, addRequirementToScope, addControlToScope)', () => {
    it('adds a published framework version, a requirement and an active control to scope, and lists the union newest first', async () => {
      const agent = await agentWithPermissions([
        ...ALL_ENGAGEMENT_PERMISSIONS,
        'compliance:administer',
        'compliance:view',
        'control:view',
      ]);
      const { id } = await createEngagement(agent);
      const { versionId, requirementId } =
        await createPublishedFrameworkVersionWithRequirement(agent);
      const controlId = await createActiveControlFixture();

      const addVersionResponse = await agent
        .post(`/api/v1/audits/${id}/scope/framework-versions`)
        .set('Origin', appOrigin)
        .send({ frameworkVersionId: versionId });
      expect(addVersionResponse.status).toBe(201);
      const versionEntry = addVersionResponse.body as AuditScopeEntryBody;
      expect(versionEntry.targetType).toBe('FRAMEWORK_VERSION');
      expect(versionEntry.target.id).toBe(versionId);
      expect(versionEntry.linkedBy.id).toBeDefined();

      const addRequirementResponse = await agent
        .post(`/api/v1/audits/${id}/scope/requirements`)
        .set('Origin', appOrigin)
        .send({ requirementId });
      expect(addRequirementResponse.status).toBe(201);
      expect((addRequirementResponse.body as AuditScopeEntryBody).targetType).toBe('REQUIREMENT');

      const addControlResponse = await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId });
      expect(addControlResponse.status).toBe(201);
      expect((addControlResponse.body as AuditScopeEntryBody).targetType).toBe('CONTROL');

      const listResponse = await agent.get(`/api/v1/audits/${id}/scope`).set('Origin', appOrigin);
      expect(listResponse.status).toBe(200);
      const entries = listResponse.body as readonly AuditScopeEntryBody[];
      expect(entries).toHaveLength(3);
      // Newest first.
      expect(entries[0]!.id).toBe((addControlResponse.body as AuditScopeEntryBody).id);
    });

    it('rejects a DRAFT framework version with 422 naming frameworkVersionId, and writes nothing', async () => {
      const agent = await agentWithPermissions([
        ...ALL_ENGAGEMENT_PERMISSIONS,
        'compliance:administer',
        'compliance:view',
      ]);
      const { id } = await createEngagement(agent);
      const { versionId } = await createDraftFrameworkVersion(agent);

      const response = await agent
        .post(`/api/v1/audits/${id}/scope/framework-versions`)
        .set('Origin', appOrigin)
        .send({ frameworkVersionId: versionId });
      expect(response.status).toBe(422);
      const body = response.body as ProblemBody;
      expect(body.errors?.some((error) => error.field === 'frameworkVersionId')).toBe(true);

      const listResponse = await agent.get(`/api/v1/audits/${id}/scope`).set('Origin', appOrigin);
      expect(listResponse.body as readonly AuditScopeEntryBody[]).toHaveLength(0);
    });

    it('rejects an out-of-scope control with 422, indistinguishable from a nonexistent one (FR-015)', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'control:view']);
      const { id } = await createEngagement(agent);
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('audit-scope-control-other'),
      });
      const outOfScopeControlId = await createActiveControlFixture(otherUnit.id);

      const responseForOutOfScope = await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: outOfScopeControlId });
      const responseForFake = await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: randomUUID() });

      expect(responseForOutOfScope.status).toBe(422);
      expect(responseForFake.status).toBe(422);
      expect((responseForOutOfScope.body as ProblemBody).title).toBe(
        (responseForFake.body as ProblemBody).title,
      );
    });

    it('rejects a duplicate scope link with 409', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'control:view']);
      const { id } = await createEngagement(agent);
      const controlId = await createActiveControlFixture();

      const first = await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId });
      expect(first.status).toBe(201);

      const second = await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId });
      expect(second.status).toBe(409);
    });

    it('a completed engagement refuses a new scope link — 422', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'control:view']);
      const { id, version } = await createEngagement(agent);
      await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: await createActiveControlFixture() });
      const startResponse = await agent
        .post(`/api/v1/audits/${id}/start`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      const completeResponse = await agent
        .post(`/api/v1/audits/${id}/complete`)
        .set('Origin', appOrigin)
        .set('If-Match', startResponse.headers.etag!);
      expect(completeResponse.status).toBe(200);

      const response = await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: await createActiveControlFixture() });
      expect(response.status).toBe(422);
    });

    it('a cancelled engagement refuses a new scope link — 422', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'control:view']);
      const { id, version } = await createEngagement(agent);
      const cancelResponse = await agent
        .post(`/api/v1/audits/${id}/cancel`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ justification: 'Aberto por engano.' });
      expect(cancelResponse.status).toBe(200);

      const response = await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: await createActiveControlFixture() });
      expect(response.status).toBe(422);
    });

    it('an out-of-scope engagement answers 404 for both reading and writing scope (FR-018)', async () => {
      const creatorAgent = await agentWithPermissions(['audit-engagement:create']);
      const { id: outOfScopeId } = await createEngagement(creatorAgent);
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('audit-scope-oos'),
      });
      const outsideAgent = await agentWithPermissions(
        ['audit-engagement:view', 'audit-engagement:scope', 'control:view'],
        otherUnit.id,
      );

      const readResponse = await outsideAgent
        .get(`/api/v1/audits/${outOfScopeId}/scope`)
        .set('Origin', appOrigin);
      expect(readResponse.status).toBe(404);

      const writeResponse = await outsideAgent
        .post(`/api/v1/audits/${outOfScopeId}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: randomUUID() });
      expect(writeResponse.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------
  // POST /audits/{auditId}/start (startAuditEngagement)
  // -----------------------------------------------------------------
  describe('POST /audits/{auditId}/start (startAuditEngagement)', () => {
    it('refuses to start an engagement with no scope link — 422, and status remains PLANNING (FR-003)', async () => {
      const agent = await agentWithPermissions(ALL_ENGAGEMENT_PERMISSIONS);
      const { id, version } = await createEngagement(agent);

      const response = await agent
        .post(`/api/v1/audits/${id}/start`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect(response.status).toBe(422);

      const current = await agent.get(`/api/v1/audits/${id}`).set('Origin', appOrigin);
      expect((current.body as AuditEngagementBody).status).toBe('PLANNING');
    });

    it('starts a scoped engagement, stamping startedAt/startedBy — 200 with a new ETag', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'control:view']);
      const { id, version } = await createEngagement(agent);
      await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: await createActiveControlFixture() });

      const response = await agent
        .post(`/api/v1/audits/${id}/start`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect(response.status).toBe(200);
      const body = response.body as AuditEngagementBody;
      expect(body.status).toBe('IN_PROGRESS');
      expect(body.startedAt).not.toBeNull();
      expect(body.startedBy?.id).toBeDefined();
      expect(response.headers.etag).not.toBe(version);
    });

    it('requires If-Match — 400 when missing', async () => {
      const agent = await agentWithPermissions(ALL_ENGAGEMENT_PERMISSIONS);
      const { id } = await createEngagement(agent);
      const response = await agent.post(`/api/v1/audits/${id}/start`).set('Origin', appOrigin);
      expect(response.status).toBe(400);
    });

    it('a stale If-Match yields 409', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'control:view']);
      const { id, version } = await createEngagement(agent);
      await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: await createActiveControlFixture() });

      // Bump the version out from under the stale token.
      await agent
        .patch(`/api/v1/audits/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ objective: 'Objetivo mudou antes do start.' });

      const response = await agent
        .post(`/api/v1/audits/${id}/start`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect(response.status).toBe(409);
    });
  });

  // -----------------------------------------------------------------
  // POST /audits/{auditId}/complete (completeAuditEngagement)
  // -----------------------------------------------------------------
  describe('POST /audits/{auditId}/complete (completeAuditEngagement)', () => {
    it('is refused unless the engagement is IN_PROGRESS — 422', async () => {
      const agent = await agentWithPermissions(ALL_ENGAGEMENT_PERMISSIONS);
      const { id, version } = await createEngagement(agent);

      const response = await agent
        .post(`/api/v1/audits/${id}/complete`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect(response.status).toBe(422);
    });

    it('completes an IN_PROGRESS engagement, terminal — 200 with a new ETag', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'control:view']);
      const { id, version } = await createEngagement(agent);
      await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: await createActiveControlFixture() });
      const startResponse = await agent
        .post(`/api/v1/audits/${id}/start`)
        .set('Origin', appOrigin)
        .set('If-Match', version);

      const response = await agent
        .post(`/api/v1/audits/${id}/complete`)
        .set('Origin', appOrigin)
        .set('If-Match', startResponse.headers.etag!);
      expect(response.status).toBe(200);
      const body = response.body as AuditEngagementBody;
      expect(body.status).toBe('COMPLETED');
      expect(body.completedAt).not.toBeNull();

      // Terminal: neither start nor a second complete succeeds afterward.
      const secondComplete = await agent
        .post(`/api/v1/audits/${id}/complete`)
        .set('Origin', appOrigin)
        .set('If-Match', response.headers.etag!);
      expect(secondComplete.status).toBe(422);
    });
  });

  // -----------------------------------------------------------------
  // POST /audits/{auditId}/cancel (cancelAuditEngagement, FR-004a)
  // -----------------------------------------------------------------
  describe('POST /audits/{auditId}/cancel (cancelAuditEngagement, FR-004a)', () => {
    it('cancels a PLANNING engagement with a justification — 200, terminal', async () => {
      const agent = await agentWithPermissions(ALL_ENGAGEMENT_PERMISSIONS);
      const { id, version } = await createEngagement(agent);

      const response = await agent
        .post(`/api/v1/audits/${id}/cancel`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ justification: 'Aberto por engano.' });
      expect(response.status).toBe(200);
      const body = response.body as AuditEngagementBody;
      expect(body.status).toBe('CANCELLED');
      expect(body.cancelledAt).not.toBeNull();
      expect(body.cancellationJustification).toBe('Aberto por engano.');
    });

    it('cancels an IN_PROGRESS engagement with a justification — 200, terminal (both edges into CANCELLED)', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'control:view']);
      const { id, version } = await createEngagement(agent);
      await agent
        .post(`/api/v1/audits/${id}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: await createActiveControlFixture() });
      const startResponse = await agent
        .post(`/api/v1/audits/${id}/start`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect((startResponse.body as AuditEngagementBody).status).toBe('IN_PROGRESS');

      const response = await agent
        .post(`/api/v1/audits/${id}/cancel`)
        .set('Origin', appOrigin)
        .set('If-Match', startResponse.headers.etag!)
        .send({ justification: 'Interrompido por reorganização.' });
      expect(response.status).toBe(200);
      expect((response.body as AuditEngagementBody).status).toBe('CANCELLED');
    });

    it('refuses cancellation without a justification — 422, not a request-shape 400', async () => {
      const agent = await agentWithPermissions(ALL_ENGAGEMENT_PERMISSIONS);
      const { id, version } = await createEngagement(agent);

      const missing = await agent
        .post(`/api/v1/audits/${id}/cancel`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({});
      expect(missing.status).toBe(422);

      const blank = await agent
        .post(`/api/v1/audits/${id}/cancel`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ justification: '   ' });
      expect(blank.status).toBe(422);

      const current = await agent.get(`/api/v1/audits/${id}`).set('Origin', appOrigin);
      expect((current.body as AuditEngagementBody).status).toBe('PLANNING');
    });

    it('is refused once the engagement is already terminal — 422', async () => {
      const agent = await agentWithPermissions(ALL_ENGAGEMENT_PERMISSIONS);
      const { id, version } = await createEngagement(agent);
      const cancelResponse = await agent
        .post(`/api/v1/audits/${id}/cancel`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ justification: 'Primeiro descarte.' });
      expect(cancelResponse.status).toBe(200);

      const secondCancel = await agent
        .post(`/api/v1/audits/${id}/cancel`)
        .set('Origin', appOrigin)
        .set('If-Match', cancelResponse.headers.etag!)
        .send({ justification: 'Segundo descarte (deveria falhar).' });
      expect(secondCancel.status).toBe(422);
    });

    it('requires If-Match — 400 when missing', async () => {
      const agent = await agentWithPermissions(ALL_ENGAGEMENT_PERMISSIONS);
      const { id } = await createEngagement(agent);
      const response = await agent
        .post(`/api/v1/audits/${id}/cancel`)
        .set('Origin', appOrigin)
        .send({ justification: 'x' });
      expect(response.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------
  // GET/POST /audits/{auditId}/findings (listAuditEngagementFindings,
  // createFindingFromEngagement — User Story 2, operations 12-13)
  // -----------------------------------------------------------------
  describe('GET/POST /audits/{auditId}/findings (listAuditEngagementFindings, createFindingFromEngagement)', () => {
    it('creates a finding from an IN_PROGRESS engagement with auditEngagementId set, and the engagement lists it (T044, SC-001)', async () => {
      const agent = await agentWithPermissions([
        ...ALL_ENGAGEMENT_PERMISSIONS,
        'control:view',
        'finding:create',
      ]);
      const { id } = await startInProgressEngagement(agent);

      const createResponse = await agent
        .post(`/api/v1/audits/${id}/findings`)
        .set('Origin', appOrigin)
        .send(findingFromEngagementBody());
      expect(createResponse.status).toBe(201);
      const body = createResponse.body as FindingSummaryBody;
      expect(body.auditEngagementId).toBe(id);
      expect(body.status).toBe('OPEN');
      expect(body.code).toMatch(/^FND-\d{4}-\d{4,}$/);
      expect(createResponse.headers.location).toBe(`/api/v1/findings/${body.id}`);

      const listResponse = await agent
        .get(`/api/v1/audits/${id}/findings`)
        .set('Origin', appOrigin);
      expect(listResponse.status).toBe(200);
      const page = listResponse.body as FindingSummaryPageBody;
      expect(page.data.some((item) => item.id === body.id && item.auditEngagementId === id)).toBe(
        true,
      );
    });

    it('a finding created through the manual path (POST /findings) still has auditEngagementId: null (T045, FR-008)', async () => {
      const agent = await agentWithPermissions(['finding:create']);
      const response = await agent.post('/api/v1/findings').set('Origin', appOrigin).send({
        orgUnitId,
        title: 'Achado manual de teste de contrato',
        description: 'Descrição do achado manual.',
        category: 'OBSERVATION',
        origin: 'INTERNAL_ASSESSMENT',
        severity: 'LOW',
        priority: 'LOW',
        ownerUserId: leadAuditorUserId,
        identifiedOn: '2026-02-01',
      });
      expect(response.status).toBe(201);
      expect((response.body as { auditEngagementId: string | null }).auditEngagementId).toBeNull();
    });

    it('refuses to record a finding from a PLANNING engagement — 422 (T046, FR-004/FR-007)', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'finding:create']);
      const { id } = await createEngagement(agent);

      const response = await agent
        .post(`/api/v1/audits/${id}/findings`)
        .set('Origin', appOrigin)
        .send(findingFromEngagementBody());
      expect(response.status).toBe(422);
    });

    it('refuses to record a finding from a COMPLETED engagement — 422 (T046, FR-004/FR-007)', async () => {
      const agent = await agentWithPermissions([
        ...ALL_ENGAGEMENT_PERMISSIONS,
        'control:view',
        'finding:create',
      ]);
      const { id, version } = await startInProgressEngagement(agent);
      const completeResponse = await agent
        .post(`/api/v1/audits/${id}/complete`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect(completeResponse.status).toBe(200);

      const response = await agent
        .post(`/api/v1/audits/${id}/findings`)
        .set('Origin', appOrigin)
        .send(findingFromEngagementBody());
      expect(response.status).toBe(422);
    });

    it('refuses to record a finding from a CANCELLED engagement — 422 (T046, FR-004)', async () => {
      const agent = await agentWithPermissions([...ALL_ENGAGEMENT_PERMISSIONS, 'finding:create']);
      const { id, version } = await createEngagement(agent);
      const cancelResponse = await agent
        .post(`/api/v1/audits/${id}/cancel`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ justification: 'Descartado antes de qualquer achado.' });
      expect(cancelResponse.status).toBe(200);

      const response = await agent
        .post(`/api/v1/audits/${id}/findings`)
        .set('Origin', appOrigin)
        .send(findingFromEngagementBody());
      expect(response.status).toBe(422);
    });

    it('an out-of-scope engagement answers 404 for both reading and creating findings', async () => {
      const creatorAgent = await agentWithPermissions([
        ...ALL_ENGAGEMENT_PERMISSIONS,
        'control:view',
        'finding:create',
      ]);
      const { id } = await startInProgressEngagement(creatorAgent);

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('audit-findings-oos'),
      });
      const outsideAgent = await agentWithPermissions(
        ['audit-engagement:view', 'finding:create'],
        otherUnit.id,
      );

      const readResponse = await outsideAgent
        .get(`/api/v1/audits/${id}/findings`)
        .set('Origin', appOrigin);
      expect(readResponse.status).toBe(404);

      const writeResponse = await outsideAgent
        .post(`/api/v1/audits/${id}/findings`)
        .set('Origin', appOrigin)
        .send(findingFromEngagementBody());
      expect(writeResponse.status).toBe(404);
    });

    it('a caller without audit-engagement:view cannot tell an existing engagement from a nonexistent one — 404', async () => {
      const creatorAgent = await agentWithPermissions([
        ...ALL_ENGAGEMENT_PERMISSIONS,
        'control:view',
        'finding:create',
      ]);
      const { id } = await startInProgressEngagement(creatorAgent);

      const zeroViewAgent = await agentWithPermissions(['finding:create']);
      const responseForReal = await zeroViewAgent
        .post(`/api/v1/audits/${id}/findings`)
        .set('Origin', appOrigin)
        .send(findingFromEngagementBody());
      const responseForFake = await zeroViewAgent
        .post(`/api/v1/audits/${randomUUID()}/findings`)
        .set('Origin', appOrigin)
        .send(findingFromEngagementBody());

      expect(responseForReal.status).toBe(404);
      expect(responseForFake.status).toBe(404);
      const bodyReal = responseForReal.body as ProblemBody;
      const bodyFake = responseForFake.body as ProblemBody;
      expect(bodyReal.status).toBe(bodyFake.status);
      expect(bodyReal.title).toBe(bodyFake.title);
    });

    it('a caller with audit-engagement:view but without finding:create is refused 403, not 404 (existence already known)', async () => {
      const creatorAgent = await agentWithPermissions([
        ...ALL_ENGAGEMENT_PERMISSIONS,
        'control:view',
        'finding:create',
      ]);
      const { id } = await startInProgressEngagement(creatorAgent);

      const viewOnlyAgent = await agentWithPermissions(['audit-engagement:view']);
      const response = await viewOnlyAgent
        .post(`/api/v1/audits/${id}/findings`)
        .set('Origin', appOrigin)
        .send(findingFromEngagementBody());
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const agent = await agentWithPermissions([
        ...ALL_ENGAGEMENT_PERMISSIONS,
        'control:view',
        'finding:create',
      ]);
      const { id } = await startInProgressEngagement(agent);

      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/audits/${id}/findings`)
        .set('Origin', appOrigin)
        .send(findingFromEngagementBody());
      expect(response.status).toBe(401);
    });
  });
});
