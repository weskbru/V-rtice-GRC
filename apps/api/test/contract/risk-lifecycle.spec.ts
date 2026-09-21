/**
 * T158/T159 — D-11 coverage for every endpoint `LifecycleController` adds:
 * `GET /risks/{riskId}/lifecycle`, `POST /risks/{riskId}/transitions`,
 * `GET`/`POST /risks/{riskId}/approvals`, `POST
 * /risks/{riskId}/approvals/{approvalId}/decision`. For each: the stated
 * authorization rule (including a zero-permission/wrong-permission caller
 * refused), a 401 for an unauthenticated caller, and the declared response
 * shape — per `docs/local-environment.md` D-11, regardless of what
 * `tasks.md` itself lists.
 *
 * T159's own filtering proof lives here too: a caller who holds `risk:view`
 * but NOT `risk:transition` sees NO gated transition
 * (`ACCEPTED`/`UNDER_REVIEW`) in `availableTransitions` from a state where
 * both are structurally legal — FR-082's "valid from the current state AND
 * permitted to the current user".
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
import {
  createLocalUserFixture,
  createMethodologyVersionFixture,
  createOrgUnitFixture,
  createUserFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface ProblemBody {
  readonly status: number;
}

interface RiskDetailBody {
  readonly id: string;
  readonly status: string;
  readonly pendingApproval: boolean;
  readonly pendingApprovalDetail: ApprovalBody | null;
}

interface AvailableTransitionBody {
  readonly toStatus: string;
  readonly requiredPermission: string;
  readonly requiresApproval: boolean;
  readonly preconditionsMet: boolean;
  readonly unmetPreconditions: readonly string[];
}

interface RiskLifecycleStateBody {
  readonly status: string;
  readonly pendingApproval: unknown;
  readonly availableTransitions: readonly AvailableTransitionBody[];
  readonly traversedStatuses: readonly string[];
}

interface ApprovalBody {
  readonly id: string;
  readonly requestedTransition: string;
  readonly requestedBy: { readonly id: string };
  readonly requestedAt: string;
  readonly status: string;
  readonly decidedBy: { readonly id: string } | null;
  readonly decidedAt: string | null;
  readonly justification: string | null;
}

interface LifecycleTransitionBody {
  readonly id: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly performedBy: { readonly id: string };
  readonly performedAt: string;
}

describe('Risk Lifecycle endpoints (T158, T159, D-11, ADR-006)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerUserId: string;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const marker = uniqueTestMarker('risk-lifecycle-contract');
    const orgUnit = await createOrgUnitFixture(prisma, { code: `${marker}-org` });
    orgUnitId = orgUnit.id;
    const owner = await createUserFixture(prisma, { email: `${marker}-owner@example.test` });
    ownerUserId = owner.id;
    // F-CV-2 (`risks-lifecycle-audit`): owner assignability now also
    // requires `risk:view` + scope reaching the risk's unit — see
    // `risk-immutability.spec.ts`'s identical fixup for the full reasoning.
    const ownerRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-${marker}-owner-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: owner, role: ownerRole });
    await grantUnitScopeFixture(prisma, { user: owner, orgUnitId });
    const category = await prisma.client.riskCategory.create({
      data: {
        id: randomUUID(),
        code: `${marker}-category`,
        name: 'Categoria de teste',
        description: 'Fixture category.',
        sortOrder: 1,
        isActive: true,
      },
    });
    categoryId = category.id;

    const methodologyAuthor = await createUserFixture(prisma, {
      email: `${marker}-methodology-author@example.test`,
    });
    await createMethodologyVersionFixture(prisma, methodologyAuthor.id);
  });

  afterAll(async () => {
    // `risk_categories` is a global, unscoped reference table that
    // `global-setup.ts` truncates ONCE per `vitest run`, not per file
    // (`vitest.contract.config.ts` runs every contract spec sequentially
    // against ONE shared database, `fileParallelism: false`) — an ACTIVE
    // row left behind here would leak into `reference-data.spec.ts`'s own
    // "returns exactly the active categories" assertion, which (correctly,
    // for ITS OWN fixtures) assumes no other active category exists in the
    // database at the point it runs. Deactivating rather than deleting:
    // `Risk.categoryId` is `onDelete: Restrict` and this run's risks still
    // reference it.
    await ctx.app
      .get(PrismaService)
      .client.riskCategory.update({ where: { id: categoryId }, data: { isActive: false } });
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: Parameters<typeof createRoleWithPermissionsFixture>[1],
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${randomUUID()}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-risk-lifecycle-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return agent;
  }

  async function createRisk(
    agent: ReturnType<typeof request.agent>,
  ): Promise<{ id: string; etag: string }> {
    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para testes de ciclo de vida',
      description: 'Descrição do risco.',
      categoryId,
      orgUnitId,
      ownerUserId,
    });
    expect(response.status).toBe(201);
    const body = response.body as RiskDetailBody;
    return { id: body.id, etag: response.headers.etag! };
  }

  /** Records an assessment on the risk (needed for `HAS_ASSESSMENT`-gated
   * transitions), returning the risk's current ETag afterward. */
  async function assessRisk(
    agent: ReturnType<typeof request.agent>,
    riskId: string,
    etag: string,
  ): Promise<string> {
    const response = await agent
      .post(`/api/v1/risks/${riskId}/assessments`)
      .set('Origin', appOrigin)
      .set('If-Match', etag)
      .send({
        inherentProbability: 4,
        inherentImpact: 4,
        residualProbability: 2,
        residualImpact: 2,
        rationale: 'Avaliação inicial.',
      });
    expect(response.status).toBe(201);
    return response.headers.etag!;
  }

  // -------------------------------------------------------------------
  // GET /risks/{riskId}/lifecycle
  // -------------------------------------------------------------------

  describe('GET /risks/{riskId}/lifecycle', () => {
    it('succeeds for a caller holding risk:view and returns the declared RiskLifecycleState shape', async () => {
      const agent = await agentWithPermissions(['risk:create', 'risk:view']);
      const { id } = await createRisk(agent);

      const response = await agent.get(`/api/v1/risks/${id}/lifecycle`).set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as RiskLifecycleStateBody;
      expect(body.status).toBe('DRAFT');
      expect(body.pendingApproval).toBeNull();
      expect(Array.isArray(body.availableTransitions)).toBe(true);
      // F-CV-3: a brand-new risk has traversed exactly its own starting
      // status — never empty, never inferred from `status` client-side.
      expect(body.traversedStatuses).toEqual(['DRAFT']);
    });

    it('refuses a caller lacking risk:view — 403', async () => {
      const creator = await agentWithPermissions(['risk:create', 'risk:view']);
      const { id } = await createRisk(creator);

      const bare = await agentWithPermissions([]);
      const response = await bare.get(`/api/v1/risks/${id}/lifecycle`).set('Origin', appOrigin);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/risks/${randomUUID()}/lifecycle`,
      );
      expect(response.status).toBe(401);
    });

    it('T159: a caller holding risk:view + risk:edit but NOT risk:transition/risk:assess never sees those transitions, even though DRAFT_FIELDS_COMPLETE is satisfied', async () => {
      const agent = await agentWithPermissions(['risk:create', 'risk:view', 'risk:edit']);
      const { id } = await createRisk(agent);

      const response = await agent.get(`/api/v1/risks/${id}/lifecycle`).set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as RiskLifecycleStateBody;

      // DRAFT -> IDENTIFIED (risk:edit) IS offered - the caller holds it.
      const toIdentified = body.availableTransitions.find((t) => t.toStatus === 'IDENTIFIED');
      expect(toIdentified).toBeDefined();
      expect(toIdentified!.preconditionsMet).toBe(true);

      // No OTHER transition is structurally reachable from DRAFT per the
      // table, so this caller's list is exactly one entry — proving the
      // endpoint does not offer anything beyond what is BOTH legal from the
      // current state AND permitted to this caller.
      expect(body.availableTransitions).toHaveLength(1);
    });

    it('T159: from ASSESSED, a caller without risk:transition sees no gated transition (ACCEPTED/UNDER_REVIEW), while a caller who also holds risk:transition does', async () => {
      const requester = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'risk:assess',
        'risk:transition',
      ]);
      const { id, etag } = await createRisk(requester);
      const etagAfterAssessment = await assessRisk(requester, id, etag);

      const toIdentified = await requester
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', etagAfterAssessment)
        .send({ toStatus: 'IDENTIFIED' });
      expect(toIdentified.status).toBe(200);

      const toAssessed = await requester
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', toIdentified.headers.etag!)
        .send({ toStatus: 'ASSESSED' });
      expect(toAssessed.status).toBe(200);

      // Caller WITHOUT risk:transition — only risk:view + risk:treat.
      const limitedViewer = await agentWithPermissions(['risk:view', 'risk:treat']);
      const limitedResponse = await limitedViewer
        .get(`/api/v1/risks/${id}/lifecycle`)
        .set('Origin', appOrigin);
      expect(limitedResponse.status).toBe(200);
      const limitedBody = limitedResponse.body as RiskLifecycleStateBody;
      const limitedTargets = limitedBody.availableTransitions.map((t) => t.toStatus);
      expect(limitedTargets).not.toContain('ACCEPTED');
      expect(limitedTargets).not.toContain('UNDER_REVIEW');
      // UNDER_TREATMENT (risk:treat) IS offered - the caller holds THAT permission.
      expect(limitedTargets).toContain('UNDER_TREATMENT');

      // Caller WITH risk:transition sees the gated targets too (still
      // subject to their own preconditions, e.g. HAS_ASSESSMENT — already
      // met here).
      const fullViewer = await agentWithPermissions(['risk:view', 'risk:transition']);
      const fullResponse = await fullViewer
        .get(`/api/v1/risks/${id}/lifecycle`)
        .set('Origin', appOrigin);
      expect(fullResponse.status).toBe(200);
      const fullBody = fullResponse.body as RiskLifecycleStateBody;
      const fullTargets = fullBody.availableTransitions.map((t) => t.toStatus);
      expect(fullTargets).toContain('ACCEPTED');
      expect(fullTargets).toContain('UNDER_REVIEW');
      const acceptedEntry = fullBody.availableTransitions.find((t) => t.toStatus === 'ACCEPTED');
      expect(acceptedEntry!.requiresApproval).toBe(true);
      expect(acceptedEntry!.preconditionsMet).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // POST /risks/{riskId}/transitions
  // -------------------------------------------------------------------

  describe('POST /risks/{riskId}/transitions', () => {
    it('succeeds for a caller holding the transition-specific permission and returns the declared RiskLifecycleTransition shape', async () => {
      const agent = await agentWithPermissions(['risk:create', 'risk:view', 'risk:edit']);
      const { id, etag } = await createRisk(agent);

      const response = await agent
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', etag)
        .send({ toStatus: 'IDENTIFIED', justification: 'Risco identificado.' });

      expect(response.status).toBe(200);
      expect(response.headers.etag).toBeDefined();
      const body = response.body as LifecycleTransitionBody;
      expect(body.id).toBeTruthy();
      expect(body.fromStatus).toBe('DRAFT');
      expect(body.toStatus).toBe('IDENTIFIED');
      expect(body.performedBy.id).toBeTruthy();
      expect(body.performedAt).toBeTruthy();
    });

    it('refuses a zero-permission authenticated caller with 403 (the pair-specific permission check)', async () => {
      const creator = await agentWithPermissions(['risk:create', 'risk:view', 'risk:edit']);
      const { id, etag } = await createRisk(creator);

      const bare = await agentWithPermissions([]);
      const response = await bare
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', etag)
        .send({ toStatus: 'IDENTIFIED' });

      expect(response.status).toBe(403);
    });

    it('refuses an illegal (from, to) pair with 422, leaving the record unchanged (FR-081)', async () => {
      const agent = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'risk:administer',
      ]);
      const { id, etag } = await createRisk(agent);

      const response = await agent
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', etag)
        .send({ toStatus: 'ARCHIVED' }); // DRAFT -> ARCHIVED is not in the table.

      expect(response.status).toBe(422);
      const problem = response.body as ProblemBody;
      expect(problem.status).toBe(422);

      const getAfter = await agent.get(`/api/v1/risks/${id}`).set('Origin', appOrigin);
      expect((getAfter.body as RiskDetailBody).status).toBe('DRAFT');
    });

    it('refuses requesting a gated transition through this endpoint with 422 (must use the approvals endpoint)', async () => {
      const agent = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'risk:assess',
        'risk:transition',
      ]);
      const { id, etag } = await createRisk(agent);
      const etagAfterAssessment = await assessRisk(agent, id, etag);

      const toIdentified = await agent
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', etagAfterAssessment)
        .send({ toStatus: 'IDENTIFIED' });
      const toAssessed = await agent
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', toIdentified.headers.etag!)
        .send({ toStatus: 'ASSESSED' });

      const gatedAttempt = await agent
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', toAssessed.headers.etag!)
        .send({ toStatus: 'ACCEPTED' });

      expect(gatedAttempt.status).toBe(422);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/risks/${randomUUID()}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"')
        .send({ toStatus: 'IDENTIFIED' });

      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // GET/POST /risks/{riskId}/approvals
  // -------------------------------------------------------------------

  describe('GET /risks/{riskId}/approvals', () => {
    it('succeeds for a caller holding risk:view and returns an array (empty when no approval has ever been requested)', async () => {
      const agent = await agentWithPermissions(['risk:create', 'risk:view']);
      const { id } = await createRisk(agent);

      const response = await agent.get(`/api/v1/risks/${id}/approvals`).set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body as unknown[]).toHaveLength(0);
    });

    it('refuses a caller lacking risk:view — 403', async () => {
      const creator = await agentWithPermissions(['risk:create', 'risk:view']);
      const { id } = await createRisk(creator);

      const bare = await agentWithPermissions([]);
      const response = await bare.get(`/api/v1/risks/${id}/approvals`).set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('an out-of-scope caller holding risk:view is refused 404, byte-identical to a nonexistent risk (ADR-004/ADR-009) — previously this endpoint bypassed scope entirely and returned 200 with the real approval history', async () => {
      const creator = await agentWithPermissions(['risk:create', 'risk:view']);
      const { id } = await createRisk(creator);

      const prisma = ctx.app.get(PrismaService);
      const otherOrgUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('risk-lifecycle-approvals-other-org'),
      });
      const outsider = await createLocalUserFixture(prisma, {
        email: `${randomUUID()}@example.test`,
        primaryOrgUnitId: otherOrgUnit.id,
      });
      const outsiderRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
        name: `fixture-risk-lifecycle-approvals-outsider-role-${randomUUID()}`,
      });
      await assignRoleFixture(prisma, { user: outsider.user, role: outsiderRole });
      await grantUnitScopeFixture(prisma, { user: outsider.user, orgUnitId: otherOrgUnit.id });

      const outsiderAgent = request.agent(ctx.app.getHttpServer());
      const login = await outsiderAgent
        .post('/api/v1/auth/login')
        .set('Origin', appOrigin)
        .send({ email: outsider.user.email, password: outsider.rawPassword });
      expect(login.status).toBe(200);

      const outOfScopeResponse = await outsiderAgent
        .get(`/api/v1/risks/${id}/approvals`)
        .set('Origin', appOrigin);
      const nonexistentResponse = await outsiderAgent
        .get(`/api/v1/risks/${randomUUID()}/approvals`)
        .set('Origin', appOrigin);

      expect(outOfScopeResponse.status).toBe(404);
      expect(nonexistentResponse.status).toBe(404);
      // Byte-identical PROBLEM SHAPE — `detail`/`instance`/`correlationId`
      // legitimately differ (different risk id, different per-request
      // correlation id), but nothing else distinguishes "exists, out of
      // scope" from "does not exist" (the response body's own content,
      // not merely its status code).
      const nonexistentProblem = nonexistentResponse.body as {
        readonly type: string;
        readonly title: string;
        readonly status: number;
      };
      expect(outOfScopeResponse.body).toMatchObject({
        type: nonexistentProblem.type,
        title: nonexistentProblem.title,
        status: nonexistentProblem.status,
      });
      // Not an array of the real approval history (what the bug returned).
      expect(Array.isArray(outOfScopeResponse.body)).toBe(false);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/risks/${randomUUID()}/approvals`,
      );
      expect(response.status).toBe(401);
    });
  });

  describe('POST /risks/{riskId}/approvals', () => {
    /** Walks a fresh risk to `ASSESSED` — the state both the direct
     * transitions and the request-approval flow exercised below need. */
    async function buildAssessedRisk(
      requester: ReturnType<typeof request.agent>,
    ): Promise<{ id: string; etag: string }> {
      const { id, etag } = await createRisk(requester);
      const etagAfterAssessment = await assessRisk(requester, id, etag);
      const toIdentified = await requester
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', etagAfterAssessment)
        .send({ toStatus: 'IDENTIFIED' });
      const toAssessed = await requester
        .post(`/api/v1/risks/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', toIdentified.headers.etag!)
        .send({ toStatus: 'ASSESSED' });
      return { id, etag: toAssessed.headers.etag! };
    }

    it('succeeds for a caller holding risk:transition and returns the declared Approval shape; the risk stays in its current state (FR-029c)', async () => {
      const requester = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'risk:assess',
        'risk:transition',
      ]);
      const { id, etag } = await buildAssessedRisk(requester);

      const response = await requester
        .post(`/api/v1/risks/${id}/approvals`)
        .set('Origin', appOrigin)
        .set('If-Match', etag)
        .send({ toStatus: 'ACCEPTED', justification: 'Risco aceito pela diretoria.' });

      expect(response.status).toBe(201);
      expect(response.headers.etag).toBeDefined();
      expect(response.headers.location).toContain(`/risks/${id}/approvals/`);
      const body = response.body as ApprovalBody;
      expect(body.id).toBeTruthy();
      expect(body.requestedTransition).toBe('ASSESSED->ACCEPTED');
      expect(body.requestedBy.id).toBeTruthy();
      expect(body.status).toBe('PENDING');
      expect(body.decidedBy).toBeNull();

      const getRisk = await requester.get(`/api/v1/risks/${id}`).set('Origin', appOrigin);
      expect((getRisk.body as RiskDetailBody).status).toBe('ASSESSED');
    });

    // Assurance fix (Fix 4, confirmed defect) — `GET /risks/{id}` used to
    // report `pendingApproval: true, pendingApprovalDetail: null`
    // unconditionally, even though this SAME endpoint
    // (`GET /risks/{id}/approvals`) already returned the real `PENDING`
    // row.
    it('Fix 4: GET /risks/{riskId} populates pendingApprovalDetail with the SAME approval GET .../approvals returns, not null', async () => {
      const requester = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'risk:assess',
        'risk:transition',
      ]);
      const { id, etag } = await buildAssessedRisk(requester);

      const requestResponse = await requester
        .post(`/api/v1/risks/${id}/approvals`)
        .set('Origin', appOrigin)
        .set('If-Match', etag)
        .send({ toStatus: 'ACCEPTED', justification: 'Risco aceito pela diretoria.' });
      expect(requestResponse.status).toBe(201);
      const requestedApproval = requestResponse.body as ApprovalBody;

      const getRisk = await requester.get(`/api/v1/risks/${id}`).set('Origin', appOrigin);
      expect(getRisk.status).toBe(200);
      const body = getRisk.body as RiskDetailBody;
      expect(body.pendingApproval).toBe(true);
      expect(body.pendingApprovalDetail).not.toBeNull();
      expect(body.pendingApprovalDetail?.id).toBe(requestedApproval.id);
      expect(body.pendingApprovalDetail?.status).toBe('PENDING');
      expect(body.pendingApprovalDetail?.requestedTransition).toBe('ASSESSED->ACCEPTED');

      const listApprovals = await requester
        .get(`/api/v1/risks/${id}/approvals`)
        .set('Origin', appOrigin);
      const [approvalFromList] = listApprovals.body as readonly ApprovalBody[];
      expect(body.pendingApprovalDetail).toEqual(approvalFromList);
    });

    it('refuses a caller with risk:edit but WITHOUT risk:transition — 403', async () => {
      const requester = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'risk:assess',
        'risk:transition',
      ]);
      const { id, etag } = await buildAssessedRisk(requester);

      const editorOnly = await agentWithPermissions(['risk:view', 'risk:edit']);
      const response = await editorOnly
        .post(`/api/v1/risks/${id}/approvals`)
        .set('Origin', appOrigin)
        .set('If-Match', etag)
        .send({ toStatus: 'ACCEPTED' });

      expect(response.status).toBe(403);
    });

    it('refuses a second concurrent request while one is pending — 409', async () => {
      const requester = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'risk:assess',
        'risk:transition',
      ]);
      const { id, etag } = await buildAssessedRisk(requester);

      const first = await requester
        .post(`/api/v1/risks/${id}/approvals`)
        .set('Origin', appOrigin)
        .set('If-Match', etag)
        .send({ toStatus: 'ACCEPTED' });
      expect(first.status).toBe(201);

      const second = await requester
        .post(`/api/v1/risks/${id}/approvals`)
        .set('Origin', appOrigin)
        .set('If-Match', first.headers.etag!)
        .send({ toStatus: 'ACCEPTED' });

      expect(second.status).toBe(409);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/risks/${randomUUID()}/approvals`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"')
        .send({ toStatus: 'ACCEPTED' });

      expect(response.status).toBe(401);
    });

    describe('POST /risks/{riskId}/approvals/{approvalId}/decision', () => {
      it('succeeds for a caller holding risk:approve and returns the declared Approval shape; APPROVED applies the transition', async () => {
        const requester = await agentWithPermissions([
          'risk:create',
          'risk:view',
          'risk:edit',
          'risk:assess',
          'risk:transition',
        ]);
        const { id, etag } = await buildAssessedRisk(requester);

        const requested = await requester
          .post(`/api/v1/risks/${id}/approvals`)
          .set('Origin', appOrigin)
          .set('If-Match', etag)
          .send({ toStatus: 'ACCEPTED' });
        expect(requested.status).toBe(201);
        const approval = requested.body as ApprovalBody;

        const approver = await agentWithPermissions(['risk:view', 'risk:approve']);
        const response = await approver
          .post(`/api/v1/risks/${id}/approvals/${approval.id}/decision`)
          .set('Origin', appOrigin)
          .set('If-Match', requested.headers.etag!)
          .send({ decision: 'APPROVED', justification: 'Aprovado.' });

        expect(response.status).toBe(200);
        expect(response.headers.etag).toBeDefined();
        const body = response.body as ApprovalBody;
        expect(body.status).toBe('APPROVED');
        expect(body.decidedBy).not.toBeNull();
        expect(body.decidedAt).toBeTruthy();

        const getRisk = await requester.get(`/api/v1/risks/${id}`).set('Origin', appOrigin);
        expect((getRisk.body as RiskDetailBody).status).toBe('ACCEPTED');
      });

      it('refuses a caller holding risk:transition but NOT risk:approve — 403 (segregation of the REQUEST/DECIDE permissions)', async () => {
        const requester = await agentWithPermissions([
          'risk:create',
          'risk:view',
          'risk:edit',
          'risk:assess',
          'risk:transition',
        ]);
        const { id, etag } = await buildAssessedRisk(requester);

        const requested = await requester
          .post(`/api/v1/risks/${id}/approvals`)
          .set('Origin', appOrigin)
          .set('If-Match', etag)
          .send({ toStatus: 'ACCEPTED' });
        const approval = requested.body as ApprovalBody;

        const response = await requester
          .post(`/api/v1/risks/${id}/approvals/${approval.id}/decision`)
          .set('Origin', appOrigin)
          .set('If-Match', requested.headers.etag!)
          .send({ decision: 'APPROVED' });

        expect(response.status).toBe(403);
      });

      it('refuses the requester deciding their own request — 422 (FR-029a)', async () => {
        const requester = await agentWithPermissions([
          'risk:create',
          'risk:view',
          'risk:edit',
          'risk:assess',
          'risk:transition',
          'risk:approve',
        ]);
        const { id, etag } = await buildAssessedRisk(requester);

        const requested = await requester
          .post(`/api/v1/risks/${id}/approvals`)
          .set('Origin', appOrigin)
          .set('If-Match', etag)
          .send({ toStatus: 'ACCEPTED' });
        const approval = requested.body as ApprovalBody;

        const response = await requester
          .post(`/api/v1/risks/${id}/approvals/${approval.id}/decision`)
          .set('Origin', appOrigin)
          .set('If-Match', requested.headers.etag!)
          .send({ decision: 'APPROVED' });

        expect(response.status).toBe(422);
      });

      it('refuses an unauthenticated caller — 401', async () => {
        const response = await request(ctx.app.getHttpServer())
          .post(`/api/v1/risks/${randomUUID()}/approvals/${randomUUID()}/decision`)
          .set('Origin', appOrigin)
          .set('If-Match', '"0"')
          .send({ decision: 'APPROVED' });

        expect(response.status).toBe(401);
      });
    });
  });
});
