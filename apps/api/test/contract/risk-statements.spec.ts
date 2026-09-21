/**
 * T093/F-31 — `PUT /risks/{riskId}/causes` and `PUT /risks/{riskId}/consequences`
 * (`contracts/risks.openapi.yaml` ~320/~364, FR-057, ADR-013). Neither
 * route existed at all before this dispatch (`docs/deferred-findings.md`
 * F-31) — the causes/consequences editor was mounted on the risk detail
 * page and silently could not save. This file proves the fix end to end
 * against real HTTP, mirroring `risk-update.spec.ts`'s coverage shape for
 * `PATCH /risks/{riskId}` (D-11: success path, optimistic locking,
 * authorization, and the declared response shape) plus the replace-specific
 * behaviour the contract calls out: the complete list is replaced
 * (including emptying it), and the SAME `ETag`/`If-Match` mechanism the
 * risk aggregate already uses elsewhere covers BOTH lists —
 * `apps/web/src/features/risks/components/risk-causes-consequences.tsx`'s
 * own comment: "the ETag ... after either list saves successfully, so the
 * caller (and this component's *other* list) always mutate against the
 * current version" — proven here by using the `ETag` returned from a causes
 * save as the `If-Match` for the following consequences save.
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { formatETag } from '../../src/modules/risk/presentation/risk.controller';
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

interface RiskStatementBody {
  readonly id: string;
  readonly description: string;
  readonly sortOrder: number;
}

interface RiskDetailBody {
  readonly id: string;
  readonly version: number;
  readonly causes: readonly RiskStatementBody[];
  readonly consequences: readonly RiskStatementBody[];
}

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly type: string;
  readonly detail: string;
}

interface VersionConflictProblemBody {
  readonly status: number;
  readonly currentVersion: number;
}

interface AuditEventBody {
  readonly action: string;
  readonly previousValues: Record<string, unknown> | null;
  readonly newValues: Record<string, unknown> | null;
}

interface AuditEventsPageBody {
  readonly data: readonly AuditEventBody[];
}

describe('PUT /risks/{riskId}/causes and /consequences (T093, F-31, FR-057, ADR-013)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerId: string;
  let actorUserId: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-statements-org'),
    });
    orgUnitId = orgUnit.id;
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-statements-owner')}@example.test`,
    });
    ownerId = owner.id;
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });

    const actorFixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-statements-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    actorUserId = actorFixture.user.id;
    const role = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:create', 'risk:edit', 'risk:view', 'audit:view'],
      { name: `fixture-risk-statements-role-${randomUUID()}` },
    );
    await assignRoleFixture(prisma, { user: actorFixture.user, role });
    await grantUnitScopeFixture(prisma, { user: actorFixture.user, orgUnitId: orgUnit.id });

    agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: actorFixture.user.email, password: actorFixture.rawPassword });
    expect(loginResponse.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function createRisk(
    causes: readonly string[] = [],
    consequences: readonly string[] = [],
  ): Promise<string> {
    const createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    const risk = await createRiskUseCase.execute({
      actorUserId,
      title: 'Risco para teste de causas e consequências',
      description: 'Descrição original.',
      orgUnitId,
      ownerUserId: ownerId,
      causes,
      consequences,
    });
    return risk.id;
  }

  it('replaces the causes, returns them in order with an incremented ETag, and that SAME ETag then saves the consequences (the cross-list If-Match flow the editor relies on)', async () => {
    const riskId = await createRisk(['Causa original']);

    const causesResponse = await agent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: ['Primeira nova causa', 'Segunda nova causa'] });

    expect(causesResponse.status).toBe(200);
    const causesBody = causesResponse.body as RiskStatementBody[];
    expect(causesBody).toHaveLength(2);
    expect(causesBody[0]!.description).toBe('Primeira nova causa');
    expect(causesBody[0]!.sortOrder).toBe(0);
    expect(causesBody[1]!.description).toBe('Segunda nova causa');
    expect(causesBody[1]!.sortOrder).toBe(1);
    const causesEtag = causesResponse.headers.etag!;
    expect(causesEtag).toBe(formatETag(1));

    // The editor's own comment: the ETag from saving ONE list is what the
    // OTHER list's next save must use — never a stale value carried from
    // before the causes save.
    const consequencesResponse = await agent
      .put(`/api/v1/risks/${riskId}/consequences`)
      .set('Origin', appOrigin)
      .set('If-Match', causesEtag)
      .send({ items: ['Nova consequência'] });

    expect(consequencesResponse.status).toBe(200);
    const consequencesBody = consequencesResponse.body as RiskStatementBody[];
    expect(consequencesBody).toHaveLength(1);
    expect(consequencesBody[0]!.description).toBe('Nova consequência');
    expect(consequencesResponse.headers.etag).toBe(formatETag(2));

    // Persisted, not merely echoed: a fresh GET agrees on both lists and
    // the final version.
    const getResponse = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect(getResponse.status).toBe(200);
    const detail = getResponse.body as RiskDetailBody;
    expect(detail.version).toBe(2);
    expect(detail.causes.map((c) => c.description)).toEqual([
      'Primeira nova causa',
      'Segunda nova causa',
    ]);
    expect(detail.consequences.map((c) => c.description)).toEqual(['Nova consequência']);
    expect(getResponse.headers.etag).toBe(formatETag(2));
  });

  it('replaces the WHOLE list, including emptying it with items: []', async () => {
    const riskId = await createRisk(['A ser removida 1', 'A ser removida 2']);

    const response = await agent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: [] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);

    const getResponse = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect((getResponse.body as RiskDetailBody).causes).toEqual([]);
  });

  it('rejects a stale If-Match with 409, echoes the current version, and does NOT write the stale request', async () => {
    const riskId = await createRisk(['Causa inicial']);

    const firstPut = await agent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: ['Causa aplicada'] });
    expect(firstPut.status).toBe(200);

    const stalePut = await agent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: ['Esta escrita não deveria ser aplicada'] });

    expect(stalePut.status).toBe(409);
    expect(stalePut.headers['content-type']).toContain('application/problem+json');
    const conflictBody = stalePut.body as VersionConflictProblemBody;
    expect(conflictBody.status).toBe(409);
    expect(conflictBody.currentVersion).toBe(1);
    expect(stalePut.headers.etag).toBe(formatETag(1));

    const getAfter = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect((getAfter.body as RiskDetailBody).causes.map((c) => c.description)).toEqual([
      'Causa aplicada',
    ]);
  });

  it('rejects a missing If-Match with 400 before any write is attempted', async () => {
    const riskId = await createRisk(['Causa original']);

    const response = await agent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .send({ items: ['Sem If-Match'] });

    expect(response.status).toBe(400);

    const getAfter = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect((getAfter.body as RiskDetailBody).causes.map((c) => c.description)).toEqual([
      'Causa original',
    ]);
  });

  it('rejects an item list longer than 50 entries with 400 (ReplaceRiskStatementsRequest maxItems: 50)', async () => {
    const riskId = await createRisk();

    const response = await agent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: Array.from({ length: 51 }, (_unused, index) => `Causa ${String(index)}`) });

    expect(response.status).toBe(400);
  });

  it('rejects an empty-string item with 400', async () => {
    const riskId = await createRisk();

    const response = await agent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: [''] });

    expect(response.status).toBe(400);
  });

  it('rejects a body with no items property at all with 400 (items is required)', async () => {
    const riskId = await createRisk();

    const response = await agent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({});

    expect(response.status).toBe(400);
  });

  it('bumps the version on a no-op replace (identical content) but writes no audit entry for it', async () => {
    const riskId = await createRisk(['Causa estável']);

    const beforeAudit = await agent
      .get(`/api/v1/risks/${riskId}/audit-events`)
      .set('Origin', appOrigin);
    const auditCountBefore = (beforeAudit.body as AuditEventsPageBody).data.length;

    const response = await agent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: ['Causa estável'] });

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe(formatETag(1));

    const afterAudit = await agent
      .get(`/api/v1/risks/${riskId}/audit-events`)
      .set('Origin', appOrigin);
    const auditEventsAfter = (afterAudit.body as AuditEventsPageBody).data;
    expect(auditEventsAfter).toHaveLength(auditCountBefore);
  });

  it('records the previous and new causes as one audit entry, in the caller transaction (CLAUDE.md §8)', async () => {
    const riskId = await createRisk(['Causa antiga']);

    const putResponse = await agent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: ['Causa nova'] });
    expect(putResponse.status).toBe(200);

    const auditResponse = await agent
      .get(`/api/v1/risks/${riskId}/audit-events`)
      .set('Origin', appOrigin);
    expect(auditResponse.status).toBe(200);

    const causesEvent = (auditResponse.body as AuditEventsPageBody).data.find(
      (event) => event.action === 'risk.causes_replaced',
    );
    expect(causesEvent).toBeDefined();
    expect(causesEvent?.previousValues).toEqual({ causes: ['Causa antiga'] });
    expect(causesEvent?.newValues).toEqual({ causes: ['Causa nova'] });
  });

  it('refuses PUT /risks/{riskId}/causes with 403 when the caller lacks risk:edit — identically for a real risk and a nonexistent one (FR-030)', async () => {
    const riskId = await createRisk();

    const prisma = ctx.app.get(PrismaService);
    const viewOnlyOrgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-statements-viewonly-org'),
    });
    const viewOnlyFixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-statements-viewonly')}@example.test`,
      primaryOrgUnitId: viewOnlyOrgUnit.id,
    });
    const viewOnlyRole = await createRoleWithPermissionsFixture(prisma, ['risk:view'], {
      name: `fixture-risk-statements-viewonly-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: viewOnlyFixture.user, role: viewOnlyRole });
    await grantUnitScopeFixture(prisma, {
      user: viewOnlyFixture.user,
      orgUnitId: viewOnlyOrgUnit.id,
    });

    const viewOnlyAgent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await viewOnlyAgent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: viewOnlyFixture.user.email, password: viewOnlyFixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    const nonexistentRiskId = randomUUID();

    const responseForExisting = await viewOnlyAgent
      .put(`/api/v1/risks/${riskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: ['Tentativa não autorizada'] });

    const responseForNonexistent = await viewOnlyAgent
      .put(`/api/v1/risks/${nonexistentRiskId}/causes`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: ['Tentativa não autorizada'] });

    expect(responseForExisting.status).toBe(403);
    expect(responseForNonexistent.status).toBe(403);

    const existingBody = responseForExisting.body as ProblemBody;
    const nonexistentBody = responseForNonexistent.body as ProblemBody;
    expect(nonexistentBody.status).toBe(existingBody.status);
    expect(nonexistentBody.title).toBe(existingBody.title);
    expect(nonexistentBody.type).toBe(existingBody.type);
    expect(nonexistentBody.detail).toBe(existingBody.detail);

    // Nothing written by the refused attempt.
    const getAfter = await agent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin);
    expect((getAfter.body as RiskDetailBody).causes).toEqual([]);
  });

  it('refuses PUT /risks/{riskId}/consequences with 401 for an unauthenticated caller', async () => {
    const riskId = await createRisk();

    const response = await request(ctx.app.getHttpServer())
      .put(`/api/v1/risks/${riskId}/consequences`)
      .set('Origin', appOrigin)
      .set('If-Match', formatETag(0))
      .send({ items: ['Sem sessão'] });

    expect(response.status).toBe(401);
  });
});
