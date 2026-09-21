/**
 * T118 — FR-062: the API rejects a request supplying `inherentScore`,
 * `inherentLevel`, `residualScore` or `residualLevel` on
 * `POST /risks/{riskId}/assessments`. These fields are never declared on
 * `CreateAssessmentRequestDto` (T125), so the global `ValidationPipe`'s
 * `whitelist`/`forbidNonWhitelisted` (T022) rejects the request with `400`
 * before the handler — and therefore `CreateAssessmentUseCase` — ever runs,
 * exactly the same mechanism `CreateRiskRequestDto`'s own header documents
 * for `Risk` itself.
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
  makeRiskAssignmentVisible,
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
  readonly title: string;
}

interface UserRefBody {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

interface AssessmentBody {
  readonly id: string;
  readonly assessedBy: UserRefBody;
  readonly assessedOn: string;
  readonly methodologyVersion: { readonly id: string; readonly versionNumber: number };
  readonly inherentProbability: number;
  readonly inherentImpact: number;
  readonly inherentScore: number;
  readonly inherentLevel: string;
  readonly residualProbability: number;
  readonly residualImpact: number;
  readonly residualScore: number;
  readonly residualLevel: string;
  readonly controlsConsidered: readonly unknown[];
  readonly rationale: string | null;
  readonly previousAssessmentId: string | null;
  readonly levelChange: {
    readonly previousInherentLevel: string | null;
    readonly previousResidualLevel: string | null;
    readonly direction: string | null;
  };
}

interface RiskDetailBody {
  readonly id: string;
  readonly version: number;
  readonly currentAssessment: AssessmentBody | null;
}

interface AssessmentPageBody {
  readonly data: readonly AssessmentBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

const VALID_FACTORS = {
  inherentProbability: 3,
  inherentImpact: 3,
  residualProbability: 2,
  residualImpact: 2,
};

describe('Risk assessment rejects client-supplied derived fields (T118, FR-062)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-assessment-contract-org'),
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-assessment-contract')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(prisma, ['risk:assess'], {
      name: `fixture-risk-assessment-contract-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });

    agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** Body validation runs before the handler (and therefore before any
   * existence check on `riskId`), so a random, nonexistent risk id is
   * sufficient to prove the rejection happens at the DTO boundary. */
  function post(body: Record<string, unknown>) {
    return agent
      .post(`/api/v1/risks/${randomUUID()}/assessments`)
      .set('Origin', appOrigin)
      .set('If-Match', '"0"')
      .send(body);
  }

  it('rejects inherentScore with 400', async () => {
    const response = await post({ ...VALID_FACTORS, inherentScore: 25 });
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(400);
  });

  it('rejects inherentLevel with 400', async () => {
    const response = await post({ ...VALID_FACTORS, inherentLevel: 'CRITICAL' });
    expect(response.status).toBe(400);
  });

  it('rejects residualScore with 400', async () => {
    const response = await post({ ...VALID_FACTORS, residualScore: 25 });
    expect(response.status).toBe(400);
  });

  it('rejects residualLevel with 400', async () => {
    const response = await post({ ...VALID_FACTORS, residualLevel: 'CRITICAL' });
    expect(response.status).toBe(400);
  });

  it('rejects all four derived fields supplied together with 400', async () => {
    const response = await post({
      ...VALID_FACTORS,
      inherentScore: 25,
      inherentLevel: 'CRITICAL',
      residualScore: 25,
      residualLevel: 'CRITICAL',
    });
    expect(response.status).toBe(400);
  });

  it('never discloses internal detail in the rejection body (FR-107)', async () => {
    const response = await post({ ...VALID_FACTORS, inherentScore: 25 });
    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
  });
});

/**
 * T126 — `GET /risks/{riskId}`'s `currentAssessment`
 * (`contracts/risks.openapi.yaml`'s `RiskDetail.currentAssessment`, FR-093):
 * `null` for a risk that has never been assessed, and the risk's real
 * current assessment — shaped exactly as `RiskAssessment`, via the SAME
 * `assessment-response.mapper.ts` `POST /risks/{riskId}/assessments` uses
 * (ADR-009) — for one that has.
 */
describe('GET /risks/{riskId} surfaces the current assessment (T126, FR-093, ADR-009)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let agent: ReturnType<typeof request.agent>;
  let orgUnitId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-detail-assessment-org'),
    });
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-detail-assessment')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:create', 'risk:assess', 'risk:view'],
      { name: `fixture-risk-detail-assessment-role-${randomUUID()}` },
    );
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });
    // FR-068: an assessment can only be created against an ACTIVE
    // methodology version — same fixture the US4 integration suite
    // (risk-assessment-history.spec.ts) uses.
    await createMethodologyVersionFixture(prisma, fixture.user.id);

    agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    orgUnitId = orgUnit.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** Creates a fresh `DRAFT` risk over HTTP, returning its id and the
   * `version` carried in the `ETag` `POST /risks` returns (ADR-013) — so the
   * caller can immediately issue `If-Match` on a follow-up mutation without
   * a separate `GET`. */
  async function createRisk(): Promise<{ id: string; version: string }> {
    const prisma = ctx.app.get(PrismaService);
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-detail-assessment-owner')}@example.test`,
    });
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId });

    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para verificação da avaliação atual',
      description: 'Descrição do risco.',
      orgUnitId,
      ownerUserId: owner.id,
    });
    expect(response.status).toBe(201);
    const body = response.body as RiskDetailBody;

    return { id: body.id, version: response.headers.etag! };
  }

  it('returns currentAssessment: null for a risk that has never been assessed', async () => {
    const { id } = await createRisk();

    const response = await agent.get(`/api/v1/risks/${id}`).set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as RiskDetailBody;
    expect(body.currentAssessment).toBeNull();
  });

  it('returns the risk’s current assessment fully populated, matching RiskAssessment (FR-093, ADR-009)', async () => {
    const { id, version } = await createRisk();

    const createResponse = await agent
      .post(`/api/v1/risks/${id}/assessments`)
      .set('Origin', appOrigin)
      .set('If-Match', version)
      .send({
        inherentProbability: 4,
        inherentImpact: 4,
        residualProbability: 2,
        residualImpact: 2,
        rationale: 'Justificativa da avaliação.',
      });
    expect(createResponse.status).toBe(201);
    const created = createResponse.body as AssessmentBody;

    const response = await agent.get(`/api/v1/risks/${id}`).set('Origin', appOrigin);
    expect(response.status).toBe(200);
    const body = response.body as RiskDetailBody;

    expect(body.currentAssessment).not.toBeNull();
    const assessment = body.currentAssessment!;

    // Byte-for-byte the same assessment `POST` just returned — one business
    // concept (the current assessment), one representation, whether read
    // right after creation or via the risk detail endpoint (ADR-009).
    expect(assessment).toEqual(created);

    expect(assessment.id).toBe(created.id);
    expect(assessment.assessedBy.id).toBeTruthy();
    expect(assessment.inherentProbability).toBe(4);
    expect(assessment.inherentImpact).toBe(4);
    expect(assessment.residualProbability).toBe(2);
    expect(assessment.residualImpact).toBe(2);
    expect(assessment.rationale).toBe('Justificativa da avaliação.');
    expect(assessment.methodologyVersion.id).toBeTruthy();
    expect(assessment.controlsConsidered).toEqual([]);
    // First assessment on this risk — no predecessor (FR-066).
    expect(assessment.previousAssessmentId).toBeNull();
    expect(assessment.levelChange).toEqual({
      previousInherentLevel: null,
      previousResidualLevel: null,
      direction: null,
    });
  });

  it('never discloses internal detail alongside the assessment (FR-107)', async () => {
    const { id, version } = await createRisk();
    await agent
      .post(`/api/v1/risks/${id}/assessments`)
      .set('Origin', appOrigin)
      .set('If-Match', version)
      .send(VALID_FACTORS);

    const response = await agent.get(`/api/v1/risks/${id}`).set('Origin', appOrigin);
    const raw = JSON.stringify(response.body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
  });
});

/**
 * Gap-coverage — `GET /risks/{riskId}/assessments` (`AssessmentController.
 * list`, `contracts/risks.openapi.yaml` line ~406) had NO test anywhere in
 * the repository before this dispatch: every existing assessment test
 * exercised only `POST`, either over HTTP (above) or by calling
 * `CreateAssessmentUseCase` directly (integration suite). Requires
 * `risk:view` and scope (same check `GetRiskUseCase` applies to
 * `GET /risks/{riskId}` — see the controller's own doc comment), and
 * returns the `{data, meta}` envelope, newest first.
 */
describe('GET /risks/{riskId}/assessments — assessment history (FR-066)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let riskId: string;
  let riskVersion: string;
  let viewerAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-assessment-list-org'),
    });
    orgUnitId = orgUnit.id;

    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-assessment-list-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      prisma,
      ['risk:create', 'risk:assess', 'risk:view'],
      { name: `fixture-risk-assessment-list-role-${randomUUID()}` },
    );
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: orgUnit.id });
    await createMethodologyVersionFixture(prisma, fixture.user.id);

    viewerAgent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await viewerAgent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-assessment-list-owner')}@example.test`,
    });
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId });
    const createResponse = await viewerAgent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para histórico de avaliações',
      description: 'Descrição do risco.',
      orgUnitId,
      ownerUserId: owner.id,
    });
    expect(createResponse.status).toBe(201);
    const created = createResponse.body as RiskDetailBody;
    riskId = created.id;
    riskVersion = createResponse.headers.etag!;

    // Two assessments — the second review supersedes the first, so the
    // list's newest-first ordering and `previousAssessmentId` linkage are
    // both meaningfully exercised.
    const firstAssessment = await viewerAgent
      .post(`/api/v1/risks/${riskId}/assessments`)
      .set('Origin', appOrigin)
      .set('If-Match', riskVersion)
      .send({ ...VALID_FACTORS, rationale: 'Primeira avaliação.' });
    expect(firstAssessment.status).toBe(201);
    riskVersion = firstAssessment.headers.etag!;

    const secondAssessment = await viewerAgent
      .post(`/api/v1/risks/${riskId}/assessments`)
      .set('Origin', appOrigin)
      .set('If-Match', riskVersion)
      .send({ ...VALID_FACTORS, rationale: 'Reavaliação.' });
    expect(secondAssessment.status).toBe(201);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('returns the {data, meta} envelope, newest first, shaped per RiskAssessment', async () => {
    const response = await viewerAgent
      .get(`/api/v1/risks/${riskId}/assessments`)
      .set('Origin', appOrigin);

    expect(response.status).toBe(200);
    const body = response.body as AssessmentPageBody;

    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(body).not.toHaveProperty('items');
    expect(body.data).toHaveLength(2);
    expect(body.meta).toEqual({ page: 1, pageSize: 25, total: 2, totalPages: 1 });

    // Newest first: the reassessment (with a predecessor) precedes the
    // original (with none).
    expect(body.data[0]!.rationale).toBe('Reavaliação.');
    expect(body.data[0]!.previousAssessmentId).toBe(body.data[1]!.id);
    expect(body.data[1]!.rationale).toBe('Primeira avaliação.');
    expect(body.data[1]!.previousAssessmentId).toBeNull();

    for (const assessment of body.data) {
      expect(assessment.assessedBy.id).toBeTruthy();
      expect(assessment.methodologyVersion.id).toBeTruthy();
      expect(typeof assessment.inherentScore).toBe('number');
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(assessment.inherentLevel);
    }
  });

  it('refuses a caller lacking risk:view with 403', async () => {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-assessment-list-noview')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, ['risk:create'], {
      name: `fixture-risk-assessment-list-noview-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    const response = await agent
      .get(`/api/v1/risks/${riskId}/assessments`)
      .set('Origin', appOrigin);

    expect(response.status).toBe(403);
  });

  it('refuses an unauthenticated caller with 401', async () => {
    const response = await request(ctx.app.getHttpServer()).get(
      `/api/v1/risks/${riskId}/assessments`,
    );

    expect(response.status).toBe(401);
    const body = response.body as ProblemBody;
    expect(body.status).toBe(401);
  });
});
