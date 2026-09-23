import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { AppLogger } from '../../src/infrastructure/logging/app-logger.service';
import { sanitizeLogMeta } from '../../src/infrastructure/logging/logger';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { getAllPermissionDefinitions } from '../../src/permission-catalogue';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
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

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';
import type { Logger as PinoLogger } from 'pino';

interface DisclosurePattern {
  readonly name: string;
  readonly regex: RegExp;
}

const ARGON2_HASH: DisclosurePattern = {
  name: 'argon2 password hash',
  regex: /\$argon2(id|i|d)\$/,
};
const SHA256_HEX: DisclosurePattern = {
  name: '64-hex digest (session token hash or similar)',
  regex: /\b[0-9a-f]{64}\b/i,
};
const RAW_SESSION_TOKEN: DisclosurePattern = {
  name: 'raw opaque session token (base64url, 43 chars)',
  regex: /^[A-Za-z0-9_-]{43}$/,
};
const NODE_STACK_FRAME: DisclosurePattern = {
  name: 'stack trace frame',
  regex: /\bat\s+.+\(.+:\d+:\d+\)/,
};
const WINDOWS_ABS_PATH: DisclosurePattern = {
  name: 'absolute Windows filesystem path',
  regex: /[A-Za-z]:\\(?:[^\r\n"]+\\)+[^\r\n"]+/,
};
const UNIX_ABS_PATH: DisclosurePattern = {
  name: 'absolute Unix filesystem path',
  regex: /\/(?:home|Users|usr|var|etc|opt|root)\/[^\s"]+/,
};
const CONNECTION_STRING: DisclosurePattern = {
  name: 'database/cache connection string',
  regex: /(postgres(?:ql)?|redis):\/\/[^\s"]+/i,
};

const DISCLOSURE_PATTERNS: readonly DisclosurePattern[] = [
  ARGON2_HASH,
  SHA256_HEX,
  RAW_SESSION_TOKEN,
  NODE_STACK_FRAME,
  WINDOWS_ABS_PATH,
  UNIX_ABS_PATH,
  CONNECTION_STRING,
];

const ALLOWLISTED_SHA256_KEYS: ReadonlySet<string> = new Set(['checksumSha256']);

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'storageKey',
  'passwordHash',
  'tokenHash',
  'sessionId',
]);

interface Violation {
  readonly location: string;
  readonly pattern: string;
  readonly sample: string;
}

const violations: Violation[] = [];

function truncate(value: string): string {
  return value.length > 120 ? `${value.slice(0, 120)}…` : value;
}

function recordViolation(location: string, pattern: string, sample: string): void {
  violations.push({ location, pattern, sample: truncate(sample) });
}

const STACK_KEY_LOG_EXCEPTIONS: ReadonlySet<DisclosurePattern> = new Set([
  NODE_STACK_FRAME,
  WINDOWS_ABS_PATH,
  UNIX_ABS_PATH,
]);

type ScanContext = 'http' | 'log' | 'audit';

function scanJsonValue(
  location: string,
  key: string | undefined,
  value: unknown,
  context: ScanContext = 'http',
): void {
  if (key && FORBIDDEN_KEYS.has(key)) {
    recordViolation(location, `forbidden key "${key}"`, JSON.stringify(value));
  }

  if (typeof value === 'string') {
    for (const pattern of DISCLOSURE_PATTERNS) {
      if (pattern === SHA256_HEX && key && ALLOWLISTED_SHA256_KEYS.has(key)) {
        continue;
      }
      if (context === 'log' && key === 'stack' && STACK_KEY_LOG_EXCEPTIONS.has(pattern)) {
        continue;
      }
      if (pattern.regex.test(value)) {
        recordViolation(location, pattern.name, value);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanJsonValue(`${location}[${String(index)}]`, undefined, item, context),
    );
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      scanJsonValue(`${location}.${childKey}`, childKey, childValue, context);
    }
  }
}

function scanRawText(location: string, text: string): void {
  for (const pattern of DISCLOSURE_PATTERNS) {
    if (pattern.regex.test(text)) {
      recordViolation(location, pattern.name, text);
    }
  }
}

interface OpenApiOperation {
  readonly method: string;
  readonly path: string;
  readonly operationId: string;
  readonly isPublic: boolean;
}

function loadOpenApiOperations(): readonly OpenApiOperation[] {
  const committedPath = path.resolve(__dirname, '..', '..', 'openapi.json');
  const doc = JSON.parse(readFileSync(committedPath, 'utf8')) as {
    paths: Record<string, Record<string, { operationId: string; security?: unknown[] }>>;
  };
  const operations: OpenApiOperation[] = [];
  for (const [path, methods] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      operations.push({
        method: method.toUpperCase(),
        path,
        operationId: op.operationId,
        isPublic: Array.isArray(op.security) && op.security.length === 0,
      });
    }
  }
  return operations;
}

describe('Information disclosure sweep — every registered route (T202, SC-010, FR-035, FR-107, FR-108)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let prisma: PrismaService;
  let sweptOperationIds: Set<string>;
  let sweepStartedAt: Date;
  let capturedLogCalls: { level: string; payload: unknown; message: string }[];

  let superAgent: ReturnType<typeof request.agent>;
  let deciderAgent: ReturnType<typeof request.agent>;
  let disposableAgent: ReturnType<typeof request.agent>;
  let disposableUser: Awaited<ReturnType<typeof createLocalUserFixture>>;

  let orgUnitId: string;
  let superUserId: string;
  let categoryId: string;
  let riskId: string;
  let riskEtag: string;
  let approvalId: string;
  let treatmentActionId: string;
  let controlId: string;
  let processId: string;
  let assetId: string;
  let controlLinkId: string;
  let processLinkId: string;
  let assetLinkId: string;
  let notificationId: string;
  let commentId: string;
  let attachmentId: string;
  let disposableRoleId: string;
  let adminTargetUserId: string;
  let adminScopeGrantId: string;
  let disposableOrgUnitId: string;

  async function loginAs(
    email: string,
    password: string,
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(ctx.app.getHttpServer());
    const response = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password });
    expect(response.status).toBe(200);
    return agent;
  }

  async function sweep(
    operationId: string,
    exec: () => Promise<request.Response>,
  ): Promise<request.Response> {
    sweptOperationIds.add(operationId);
    const response = await exec();

    const contentType = String(response.headers['content-type'] ?? '');
    if (contentType.includes('json')) {
      scanJsonValue(operationId, undefined, response.body);
    } else if (Buffer.isBuffer(response.body) || typeof response.text === 'string') {
      scanRawText(operationId, response.text ?? '');
    }

    expect(response.headers['x-powered-by']).toBeUndefined();

    return response;
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    prisma = ctx.app.get(PrismaService);

    const marker = uniqueTestMarker('info-disclosure');
    const orgUnit = await createOrgUnitFixture(prisma, { code: `${marker}-org` });
    orgUnitId = orgUnit.id;

    const category = await prisma.client.riskCategory.create({
      data: {
        id: randomUUID(),
        code: `${marker}-category`,
        name: 'Categoria de teste (sweep)',
        description: 'Fixture category for the information-disclosure sweep.',
        sortOrder: 1,
        isActive: true,
      },
    });
    categoryId = category.id;

    const methodologyAuthor = await createUserFixture(prisma, {
      email: `${marker}-methodology-author@example.test`,
    });
    await createMethodologyVersionFixture(prisma, methodologyAuthor.id);

    const allPermissionIdentifiers = getAllPermissionDefinitions().map(
      (definition) => definition.identifier,
    ) as PermissionIdentifier[];

    const superRole = await createRoleWithPermissionsFixture(prisma, allPermissionIdentifiers, {
      name: `${marker}-super-role`,
    });
    const superUser = await createLocalUserFixture(prisma, {
      email: `${marker}-super@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    await assignRoleFixture(prisma, { user: superUser.user, role: superRole });
    await grantGlobalScopeFixture(prisma, { user: superUser.user });
    superAgent = await loginAs(superUser.user.email, superUser.rawPassword);
    superUserId = superUser.user.id;

    const deciderRole = await createRoleWithPermissionsFixture(prisma, allPermissionIdentifiers, {
      name: `${marker}-decider-role`,
    });
    const deciderUser = await createLocalUserFixture(prisma, {
      email: `${marker}-decider@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    await assignRoleFixture(prisma, { user: deciderUser.user, role: deciderRole });
    await grantGlobalScopeFixture(prisma, { user: deciderUser.user });
    deciderAgent = await loginAs(deciderUser.user.email, deciderUser.rawPassword);

    const disposableRole = await createRoleWithPermissionsFixture(
      prisma,
      allPermissionIdentifiers,
      {
        name: `${marker}-disposable-role`,
      },
    );
    disposableUser = await createLocalUserFixture(prisma, {
      email: `${marker}-disposable@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    await assignRoleFixture(prisma, { user: disposableUser.user, role: disposableRole });
    await grantGlobalScopeFixture(prisma, { user: disposableUser.user });
    disposableAgent = await loginAs(disposableUser.user.email, disposableUser.rawPassword);

    const notification = await prisma.client.notification.create({
      data: {
        id: randomUUID(),
        recipientUserId: superUser.user.id,
        type: 'TEST_FIXTURE',
        title: 'Notificação de teste (sweep)',
        body: 'Fixture notification for the information-disclosure sweep.',
        entityType: 'RISK',
      },
    });
    notificationId = notification.id;

    const [control, process_, asset] = await Promise.all([
      prisma.client.control.create({
        data: {
          id: randomUUID(),
          code: `${marker}-control`,
          name: 'Controle de teste',
          isActive: true,
        },
      }),
      prisma.client.process.create({
        data: {
          id: randomUUID(),
          code: `${marker}-process`,
          name: 'Processo de teste',
          isActive: true,
        },
      }),
      prisma.client.asset.create({
        data: { id: randomUUID(), code: `${marker}-asset`, name: 'Ativo de teste', isActive: true },
      }),
    ]);
    controlId = control.id;
    processId = process_.id;
    assetId = asset.id;

    sweptOperationIds = new Set();
    capturedLogCalls = [];

    const appLogger = ctx.app.get(AppLogger);
    const rootLogger = (appLogger as unknown as { root: PinoLogger }).root;
    for (const level of ['info', 'warn', 'error'] as const) {
      vi.spyOn(rootLogger, level).mockImplementation((...args: unknown[]) => {
        const [first, second] = args;
        capturedLogCalls.push({
          level,
          payload: first,
          message: typeof second === 'string' ? second : typeof first === 'string' ? first : '',
        });
        return rootLogger;
      });
    }

    sweepStartedAt = new Date();

    await runSweep();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.client.riskCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
    });
    await ctx.close();
  });

  async function runSweep(): Promise<void> {
    await sweep('HealthController_live', () =>
      request(ctx.app.getHttpServer()).get('/api/v1/health/live'),
    );
    await sweep('HealthController_ready', () =>
      request(ctx.app.getHttpServer()).get('/api/v1/health/ready'),
    );
    sweptOperationIds.add('AuthController_login');

    await sweep('RiskReferenceDataController_listCategories', () =>
      superAgent.get('/api/v1/risk-categories').set('Origin', appOrigin),
    );
    await sweep('RiskReferenceDataController_listTypes', () =>
      superAgent.get('/api/v1/risk-types').set('Origin', appOrigin),
    );
    await sweep('RiskReferenceDataController_listOrigins', () =>
      superAgent.get('/api/v1/risk-origins').set('Origin', appOrigin),
    );
    await sweep('OrgUnitController_list', () =>
      superAgent.get('/api/v1/org-units').set('Origin', appOrigin),
    );
    await sweep('DirectoryUsersController_list', () =>
      superAgent.get('/api/v1/users').set('Origin', appOrigin),
    );
    await sweep('ControlController_list', () =>
      superAgent.get('/api/v1/controls').set('Origin', appOrigin),
    );
    await sweep('ProcessController_list', () =>
      superAgent.get('/api/v1/processes').set('Origin', appOrigin),
    );
    await sweep('AssetController_list', () =>
      superAgent.get('/api/v1/assets').set('Origin', appOrigin),
    );

    const sweepAssetResponse = await sweep('AssetController_create', () =>
      superAgent.post('/api/v1/assets').set('Origin', appOrigin).send({
        name: 'Ativo do sweep de divulgação',
        description: 'Ativo descartável usado apenas por este sweep.',
        orgUnitId,
      }),
    );
    const sweepAssetId = (sweepAssetResponse.body as { id: string }).id;
    await sweep('AssetController_findById', () =>
      superAgent.get(`/api/v1/assets/${sweepAssetId}`).set('Origin', appOrigin),
    );
    await sweep('AssetController_update', () =>
      superAgent
        .patch(`/api/v1/assets/${sweepAssetId}`)
        .set('Origin', appOrigin)
        .send({ description: 'Ativo descartável usado apenas por este sweep (atualizado).' }),
    );
    await sweep('AssetController_deactivate', () =>
      superAgent.post(`/api/v1/assets/${sweepAssetId}/deactivate`).set('Origin', appOrigin),
    );
    await sweep('AssetController_reactivate', () =>
      superAgent.post(`/api/v1/assets/${sweepAssetId}/reactivate`).set('Origin', appOrigin),
    );

    const sweepProcessResponse = await sweep('ProcessController_create', () =>
      superAgent.post('/api/v1/processes').set('Origin', appOrigin).send({
        name: 'Processo do sweep de divulgação',
        description: 'Processo descartável usado apenas por este sweep.',
        orgUnitId,
      }),
    );
    const sweepProcessId = (sweepProcessResponse.body as { id: string }).id;
    await sweep('ProcessController_findById', () =>
      superAgent.get(`/api/v1/processes/${sweepProcessId}`).set('Origin', appOrigin),
    );
    await sweep('ProcessController_update', () =>
      superAgent
        .patch(`/api/v1/processes/${sweepProcessId}`)
        .set('Origin', appOrigin)
        .send({ description: 'Processo descartável usado apenas por este sweep (atualizado).' }),
    );
    await sweep('ProcessController_deactivate', () =>
      superAgent.post(`/api/v1/processes/${sweepProcessId}/deactivate`).set('Origin', appOrigin),
    );
    await sweep('ProcessController_reactivate', () =>
      superAgent.post(`/api/v1/processes/${sweepProcessId}/reactivate`).set('Origin', appOrigin),
    );

    await sweep('AuthController_getOwnProfile', () =>
      superAgent.get('/api/v1/auth/me').set('Origin', appOrigin),
    );
    await sweep('AuthController_getCurrentSession', () =>
      superAgent.get('/api/v1/auth/session').set('Origin', appOrigin),
    );

    await sweep('MethodologyController_getActive', () =>
      superAgent.get('/api/v1/risk-methodology').set('Origin', appOrigin),
    );
    await sweep('MethodologyController_listVersions', () =>
      superAgent.get('/api/v1/risk-methodology/versions').set('Origin', appOrigin),
    );
    const scale = [1, 2, 3, 4, 5].map((value) => ({ value, label: `P${String(value)}` }));
    const bands = [
      { level: 'LOW', minScore: 1, maxScore: 4 },
      { level: 'MEDIUM', minScore: 5, maxScore: 9 },
      { level: 'HIGH', minScore: 10, maxScore: 15 },
      { level: 'CRITICAL', minScore: 16, maxScore: 25 },
    ] as const;
    const matrix = scale.flatMap((p) =>
      scale.map((i) => {
        const score = p.value * i.value;
        const band = bands.find((b) => score >= b.minScore && score <= b.maxScore)!;
        return { probability: p.value, impact: i.value, score, level: band.level };
      }),
    );
    await sweep('MethodologyController_publishVersion', () =>
      superAgent.post('/api/v1/risk-methodology/versions').set('Origin', appOrigin).send({
        probabilityScale: scale,
        impactScale: scale,
        matrix,
        levelBands: bands,
      }),
    );

    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('info-disclosure-owner')}@example.test`,
    });
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId });
    const createRiskResponse = await sweep('RiskController_create', () =>
      superAgent.post('/api/v1/risks').set('Origin', appOrigin).send({
        title: 'Risco de teste do sweep de divulgação de informações',
        description: 'Descrição do risco de teste do sweep.',
        categoryId,
        orgUnitId,
        ownerUserId: owner.id,
      }),
    );
    riskId = (createRiskResponse.body as { id: string }).id;
    riskEtag = createRiskResponse.headers.etag!;

    await sweep('RiskController_list', () =>
      superAgent.get('/api/v1/risks').set('Origin', appOrigin),
    );
    await sweep('RiskController_findById', () =>
      superAgent.get(`/api/v1/risks/${riskId}`).set('Origin', appOrigin),
    );

    const updateResponse = await sweep('RiskController_update', () =>
      superAgent
        .patch(`/api/v1/risks/${riskId}`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ title: 'Risco de teste do sweep (atualizado)' }),
    );
    riskEtag = updateResponse.headers.etag!;

    const causesResponse = await sweep('RiskController_replaceCauses', () =>
      superAgent
        .put(`/api/v1/risks/${riskId}/causes`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ items: ['Causa de teste do sweep'] }),
    );
    riskEtag = causesResponse.headers.etag!;

    const consequencesResponse = await sweep('RiskController_replaceConsequences', () =>
      superAgent
        .put(`/api/v1/risks/${riskId}/consequences`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ items: ['Consequência de teste do sweep'] }),
    );
    riskEtag = consequencesResponse.headers.etag!;

    const assessResponse = await sweep('AssessmentController_create', () =>
      superAgent
        .post(`/api/v1/risks/${riskId}/assessments`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({
          inherentProbability: 3,
          inherentImpact: 3,
          residualProbability: 2,
          residualImpact: 2,
          rationale: 'Avaliação de teste do sweep.',
        }),
    );
    riskEtag = assessResponse.headers.etag!;
    await sweep('AssessmentController_list', () =>
      superAgent.get(`/api/v1/risks/${riskId}/assessments`).set('Origin', appOrigin),
    );

    const treatmentResponse = await sweep('TreatmentController_createTreatment', () =>
      superAgent
        .post(`/api/v1/risks/${riskId}/treatments`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ strategy: 'MITIGATE', description: 'Mitigação de teste do sweep.' }),
    );
    riskEtag = treatmentResponse.headers.etag!;
    const treatmentDecisionId = (treatmentResponse.body as { id: string }).id;
    await sweep('TreatmentController_listTreatments', () =>
      superAgent.get(`/api/v1/risks/${riskId}/treatments`).set('Origin', appOrigin),
    );

    const createActionResponse = await sweep('TreatmentController_createTreatmentAction', () =>
      superAgent
        .post(`/api/v1/risks/${riskId}/treatment-actions`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({
          title: 'Ação de tratamento de teste do sweep',
          responsibleUserId: owner.id,
          dueOn: new Date().toISOString().slice(0, 10),
          treatmentDecisionId,
        }),
    );
    riskEtag = createActionResponse.headers.etag!;
    treatmentActionId = (createActionResponse.body as { id: string }).id;
    await sweep('TreatmentController_listTreatmentActions', () =>
      superAgent.get(`/api/v1/risks/${riskId}/treatment-actions`).set('Origin', appOrigin),
    );
    const updateActionResponse = await sweep('TreatmentController_updateTreatmentAction', () =>
      superAgent
        .patch(`/api/v1/risks/${riskId}/treatment-actions/${treatmentActionId}`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ status: 'IN_PROGRESS' }),
    );
    riskEtag = updateActionResponse.headers.etag!;

    const linkControlResponse = await sweep('RiskRelationshipController_linkControl', () =>
      superAgent
        .post(`/api/v1/risks/${riskId}/controls`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ id: controlId }),
    );
    riskEtag = linkControlResponse.headers.etag!;
    controlLinkId = (linkControlResponse.body as { id: string }).id;
    await sweep('RiskRelationshipController_listControlLinks', () =>
      superAgent.get(`/api/v1/risks/${riskId}/controls`).set('Origin', appOrigin),
    );

    const linkProcessResponse = await sweep('RiskRelationshipController_linkProcess', () =>
      superAgent
        .post(`/api/v1/risks/${riskId}/processes`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ id: processId }),
    );
    riskEtag = linkProcessResponse.headers.etag!;
    processLinkId = (linkProcessResponse.body as { id: string }).id;

    const linkAssetResponse = await sweep('RiskRelationshipController_linkAsset', () =>
      superAgent
        .post(`/api/v1/risks/${riskId}/assets`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ id: assetId }),
    );
    riskEtag = linkAssetResponse.headers.etag!;
    assetLinkId = (linkAssetResponse.body as { id: string }).id;

    await sweep('LifecycleController_getLifecycle', () =>
      superAgent.get(`/api/v1/risks/${riskId}/lifecycle`).set('Origin', appOrigin),
    );

    const toIdentified = await sweep('LifecycleController_transition', () =>
      superAgent
        .post(`/api/v1/risks/${riskId}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ toStatus: 'IDENTIFIED' }),
    );
    riskEtag = toIdentified.headers.etag!;
    sweptOperationIds.add('LifecycleController_transition');
    const toAssessed = await superAgent
      .post(`/api/v1/risks/${riskId}/transitions`)
      .set('Origin', appOrigin)
      .set('If-Match', riskEtag)
      .send({ toStatus: 'ASSESSED' });
    riskEtag = toAssessed.headers.etag!;
    scanJsonValue('LifecycleController_transition[2]', undefined, toAssessed.body);

    const requestApprovalResponse = await sweep('LifecycleController_requestApproval', () =>
      superAgent
        .post(`/api/v1/risks/${riskId}/approvals`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ toStatus: 'ACCEPTED', justification: 'Justificativa de teste do sweep.' }),
    );
    riskEtag = requestApprovalResponse.headers.etag!;
    approvalId = (requestApprovalResponse.body as { id: string }).id;
    await sweep('LifecycleController_listApprovals', () =>
      superAgent.get(`/api/v1/risks/${riskId}/approvals`).set('Origin', appOrigin),
    );

    await sweep('LifecycleController_decideApproval', () =>
      deciderAgent
        .post(`/api/v1/risks/${riskId}/approvals/${approvalId}/decision`)
        .set('Origin', appOrigin)
        .set('If-Match', riskEtag)
        .send({ decision: 'APPROVED', justification: 'Aprovado no sweep de teste.' }),
    );

    await sweep('HistoryController_getHistory', () =>
      superAgent.get(`/api/v1/risks/${riskId}/history`).set('Origin', appOrigin),
    );
    await sweep('AuditController_list', () =>
      superAgent.get(`/api/v1/risks/${riskId}/audit-events`).set('Origin', appOrigin),
    );

    await sweep('RiskRelationshipController_unlinkControl', () =>
      superAgent
        .delete(`/api/v1/risks/${riskId}/controls/${controlLinkId}`)
        .set('Origin', appOrigin)
        .set('If-Match', '"999"'),
    );
    await sweep('RiskRelationshipController_unlinkProcess', () =>
      superAgent
        .delete(`/api/v1/risks/${riskId}/processes/${processLinkId}`)
        .set('Origin', appOrigin)
        .set('If-Match', '"999"'),
    );
    await sweep('RiskRelationshipController_unlinkAsset', () =>
      superAgent
        .delete(`/api/v1/risks/${riskId}/assets/${assetLinkId}`)
        .set('Origin', appOrigin)
        .set('If-Match', '"999"'),
    );

    const createControlResponse = await sweep('ControlController_create', () =>
      superAgent.post('/api/v1/controls').set('Origin', appOrigin).send({
        name: 'Controle de catálogo (sweep)',
        description: 'Controle criado pelo sweep de divulgação de informações.',
        orgUnitId,
        ownerUserId: superUserId,
        nature: 'MANUAL',
        type: 'PREVENTIVE',
        frequency: 'MONTHLY',
      }),
    );
    const sweptControlId = (createControlResponse.body as { id: string }).id;
    const sweptControlEtag = createControlResponse.headers.etag!;

    await sweep('ControlController_findById', () =>
      superAgent.get(`/api/v1/controls/${sweptControlId}`).set('Origin', appOrigin),
    );

    const updateControlResponse = await sweep('ControlController_update', () =>
      superAgent
        .patch(`/api/v1/controls/${sweptControlId}`)
        .set('Origin', appOrigin)
        .set('If-Match', sweptControlEtag)
        .send({ description: 'Descrição atualizada pelo sweep.' }),
    );

    await sweep('ControlLifecycleController_getLifecycle', () =>
      superAgent.get(`/api/v1/controls/${sweptControlId}/lifecycle`).set('Origin', appOrigin),
    );

    await sweep('ControlLifecycleController_transition', () =>
      superAgent
        .post(`/api/v1/controls/${sweptControlId}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', updateControlResponse.headers.etag ?? sweptControlEtag)
        .send({ toStatus: 'ACTIVE' }),
    );

    const assessableControl = await prisma.client.control.create({
      data: {
        id: randomUUID(),
        code: `sweep-assessable-control-${randomUUID()}`,
        name: 'Controle avaliável (sweep)',
        orgUnitId,
        status: 'ACTIVE',
        isActive: true,
      },
    });
    const assessableControlId = assessableControl.id;

    const createAssessmentResponse = await sweep('ControlAssessmentController_create', () =>
      superAgent
        .post(`/api/v1/controls/${assessableControlId}/assessments`)
        .set('Origin', appOrigin)
        .send({
          assessedOn: '2026-01-01',
          result: 'EFFECTIVE',
          conclusion: 'Conclusão de teste do sweep de divulgação de informações.',
        }),
    );
    const controlAssessmentId = (createAssessmentResponse.body as { id: string }).id;
    await sweep('ControlAssessmentController_list', () =>
      superAgent
        .get(`/api/v1/controls/${assessableControlId}/assessments`)
        .set('Origin', appOrigin),
    );
    await sweep('ControlAssessmentController_findById', () =>
      superAgent
        .get(`/api/v1/controls/${assessableControlId}/assessments/${controlAssessmentId}`)
        .set('Origin', appOrigin),
    );
    await sweep('ControlAssessmentController_requestAttestation', () =>
      superAgent
        .post(
          `/api/v1/controls/${assessableControlId}/assessments/${controlAssessmentId}/attestation`,
        )
        .set('Origin', appOrigin),
    );
    await sweep('ControlAssessmentController_decideAttestation', () =>
      deciderAgent
        .post(
          `/api/v1/controls/${assessableControlId}/assessments/${controlAssessmentId}/attestation/decision`,
        )
        .set('Origin', appOrigin)
        .send({ decision: 'APPROVED', justification: 'Aprovado no sweep de teste.' }),
    );

    const linkControlProcessResponse = await sweep(
      'ControlRelationshipController_linkProcess',
      () =>
        superAgent
          .post(`/api/v1/controls/${assessableControlId}/processes`)
          .set('Origin', appOrigin)
          .send({ id: processId }),
    );
    const controlProcessLinkId = (linkControlProcessResponse.body as { id: string }).id;
    await sweep('ControlRelationshipController_listProcessLinks', () =>
      superAgent.get(`/api/v1/controls/${assessableControlId}/processes`).set('Origin', appOrigin),
    );
    await sweep('ControlRelationshipController_unlinkProcess', () =>
      superAgent
        .delete(`/api/v1/controls/${assessableControlId}/processes/${controlProcessLinkId}`)
        .set('Origin', appOrigin),
    );

    const linkControlAssetResponse = await sweep('ControlRelationshipController_linkAsset', () =>
      superAgent
        .post(`/api/v1/controls/${assessableControlId}/assets`)
        .set('Origin', appOrigin)
        .send({ id: assetId }),
    );
    const controlAssetLinkId = (linkControlAssetResponse.body as { id: string }).id;
    await sweep('ControlRelationshipController_listAssetLinks', () =>
      superAgent.get(`/api/v1/controls/${assessableControlId}/assets`).set('Origin', appOrigin),
    );
    await sweep('ControlRelationshipController_unlinkAsset', () =>
      superAgent
        .delete(`/api/v1/controls/${assessableControlId}/assets/${controlAssetLinkId}`)
        .set('Origin', appOrigin),
    );

    await sweep('ControlRelationshipController_listRiskLinks', () =>
      superAgent.get(`/api/v1/controls/${assessableControlId}/risks`).set('Origin', appOrigin),
    );

    const createFrameworkResponse = await sweep('FrameworkController_create', () =>
      superAgent.post('/api/v1/frameworks').set('Origin', appOrigin).send({
        name: 'Framework de catálogo (sweep)',
        description: 'Framework criado pelo sweep de divulgação de informações.',
        origin: 'EXTERNAL_STANDARD',
      }),
    );
    const sweptFrameworkId = (createFrameworkResponse.body as { id: string }).id;
    const sweptFrameworkEtag = createFrameworkResponse.headers.etag!;

    await sweep('FrameworkController_list', () =>
      superAgent.get('/api/v1/frameworks').set('Origin', appOrigin),
    );
    await sweep('FrameworkController_findById', () =>
      superAgent.get(`/api/v1/frameworks/${sweptFrameworkId}`).set('Origin', appOrigin),
    );
    await sweep('FrameworkController_update', () =>
      superAgent
        .patch(`/api/v1/frameworks/${sweptFrameworkId}`)
        .set('Origin', appOrigin)
        .set('If-Match', sweptFrameworkEtag)
        .send({ description: 'Descrição atualizada pelo sweep.' }),
    );

    const createVersionResponse = await sweep('FrameworkVersionController_create', () =>
      superAgent
        .post(`/api/v1/frameworks/${sweptFrameworkId}/versions`)
        .set('Origin', appOrigin)
        .send({ label: 'sweep-v1' }),
    );
    const sweptVersionId = (createVersionResponse.body as { id: string }).id;
    const sweptVersionEtag = createVersionResponse.headers.etag!;

    await sweep('FrameworkVersionController_list', () =>
      superAgent.get(`/api/v1/frameworks/${sweptFrameworkId}/versions`).set('Origin', appOrigin),
    );
    await sweep('FrameworkVersionController_findById', () =>
      superAgent
        .get(`/api/v1/frameworks/${sweptFrameworkId}/versions/${sweptVersionId}`)
        .set('Origin', appOrigin),
    );
    const updateVersionResponse = await sweep('FrameworkVersionController_update', () =>
      superAgent
        .patch(`/api/v1/frameworks/${sweptFrameworkId}/versions/${sweptVersionId}`)
        .set('Origin', appOrigin)
        .set('If-Match', sweptVersionEtag)
        .send({ label: 'sweep-v1-revisado' }),
    );

    const createRequirementResponse = await sweep('RequirementController_create', () =>
      superAgent
        .post(`/api/v1/frameworks/${sweptFrameworkId}/versions/${sweptVersionId}/requirements`)
        .set('Origin', appOrigin)
        .send({
          externalRef: 'A.1',
          title: 'Requisito de catálogo (sweep)',
          description: 'Requisito criado pelo sweep de divulgação de informações.',
        }),
    );
    const sweptRequirementId = (createRequirementResponse.body as { id: string }).id;
    const sweptRequirementEtag = createRequirementResponse.headers.etag!;

    await sweep('RequirementController_update', () =>
      superAgent
        .patch(`/api/v1/requirements/${sweptRequirementId}`)
        .set('Origin', appOrigin)
        .set('If-Match', sweptRequirementEtag)
        .send({ title: 'Título revisado (sweep)' }),
    );

    await sweep('RequirementController_findById', () =>
      superAgent.get(`/api/v1/requirements/${sweptRequirementId}`).set('Origin', appOrigin),
    );
    await sweep('RequirementController_list', () =>
      superAgent
        .get(`/api/v1/frameworks/${sweptFrameworkId}/versions/${sweptVersionId}/requirements`)
        .set('Origin', appOrigin),
    );

    const linkRequirementControlResponse = await sweep(
      'RequirementControlLinkController_link',
      () =>
        superAgent
          .post(`/api/v1/requirements/${sweptRequirementId}/controls`)
          .set('Origin', appOrigin)
          .send({ controlId: assessableControlId }),
    );
    const sweptRequirementControlLinkId = (linkRequirementControlResponse.body as { id: string })
      .id;

    await sweep('RequirementControlLinkController_list', () =>
      superAgent
        .get(`/api/v1/requirements/${sweptRequirementId}/controls`)
        .set('Origin', appOrigin),
    );
    await sweep('RequirementControlLinkController_unlink', () =>
      superAgent
        .delete(
          `/api/v1/requirements/${sweptRequirementId}/controls/${sweptRequirementControlLinkId}`,
        )
        .set('Origin', appOrigin),
    );

    const declareApplicabilityResponse = await sweep(
      'RequirementApplicabilityController_declare',
      () =>
        superAgent
          .post(`/api/v1/requirements/${sweptRequirementId}/applicability-declarations`)
          .set('Origin', appOrigin)
          .send({ justification: 'Não se aplica ao escopo certificado (sweep).' }),
    );
    const sweptApplicabilityDeclarationId = (declareApplicabilityResponse.body as { id: string })
      .id;

    await sweep('RequirementApplicabilityController_list', () =>
      superAgent
        .get(`/api/v1/requirements/${sweptRequirementId}/applicability-declarations`)
        .set('Origin', appOrigin),
    );
    await sweep('RequirementApplicabilityController_revoke', () =>
      superAgent
        .delete(
          `/api/v1/requirements/${sweptRequirementId}/applicability-declarations/${sweptApplicabilityDeclarationId}`,
        )
        .set('Origin', appOrigin),
    );

    await sweep('ComplianceSummaryController_get', () =>
      superAgent
        .get(`/api/v1/frameworks/${sweptFrameworkId}/versions/${sweptVersionId}/compliance-summary`)
        .set('Origin', appOrigin),
    );

    const createMigrationTargetVersionResponse = await sweep(
      'FrameworkVersionController_create',
      () =>
        superAgent
          .post(`/api/v1/frameworks/${sweptFrameworkId}/versions`)
          .set('Origin', appOrigin)
          .send({ label: 'sweep-v2-destino' }),
    );
    const sweptMigrationTargetVersionId = (
      createMigrationTargetVersionResponse.body as { id: string }
    ).id;

    const createMigrationTargetRequirementResponse = await sweep(
      'RequirementController_create',
      () =>
        superAgent
          .post(
            `/api/v1/frameworks/${sweptFrameworkId}/versions/${sweptMigrationTargetVersionId}/requirements`,
          )
          .set('Origin', appOrigin)
          .send({
            externalRef: 'A.1',
            title: 'Requisito de destino da migração (sweep)',
            description: 'Requisito de destino criado pelo sweep de migração de mapeamento.',
          }),
    );
    const sweptMigrationTargetRequirementId = (
      createMigrationTargetRequirementResponse.body as { id: string }
    ).id;

    const executeMigrationResponse = await sweep('MappingMigrationController_execute', () =>
      superAgent
        .post(
          `/api/v1/frameworks/${sweptFrameworkId}/versions/${sweptMigrationTargetVersionId}/mapping-migrations`,
        )
        .set('Origin', appOrigin)
        .send({
          sourceFrameworkVersionId: sweptVersionId,
          correspondences: [
            {
              targetRequirementId: sweptMigrationTargetRequirementId,
              sourceRequirementIds: [sweptRequirementId],
            },
          ],
        }),
    );
    const sweptMigrationId = (executeMigrationResponse.body as { id: string }).id;

    await sweep('MappingMigrationController_list', () =>
      superAgent
        .get(
          `/api/v1/frameworks/${sweptFrameworkId}/versions/${sweptMigrationTargetVersionId}/mapping-migrations`,
        )
        .set('Origin', appOrigin),
    );
    await sweep('MappingMigrationController_findById', () =>
      superAgent
        .get(
          `/api/v1/frameworks/${sweptFrameworkId}/versions/${sweptMigrationTargetVersionId}/mapping-migrations/${sweptMigrationId}`,
        )
        .set('Origin', appOrigin),
    );

    await sweep('FrameworkVersionController_publish', () =>
      superAgent
        .post(`/api/v1/frameworks/${sweptFrameworkId}/versions/${sweptVersionId}/publish`)
        .set('Origin', appOrigin)
        .set('If-Match', updateVersionResponse.headers.etag ?? sweptVersionEtag),
    );

    const createEngagementResponse = await sweep('AuditEngagementController_create', () =>
      superAgent.post('/api/v1/audits').set('Origin', appOrigin).send({
        objective: 'Auditoria interna de processos financeiros (sweep).',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        orgUnitId,
        leadAuditorUserId: superUserId,
      }),
    );
    const sweptAuditEngagementId = (createEngagementResponse.body as { id: string }).id;
    const sweptAuditEngagementEtag = createEngagementResponse.headers.etag!;

    await sweep('AuditEngagementController_list', () =>
      superAgent.get('/api/v1/audits').set('Origin', appOrigin),
    );
    await sweep('AuditEngagementController_findById', () =>
      superAgent.get(`/api/v1/audits/${sweptAuditEngagementId}`).set('Origin', appOrigin),
    );
    const updateEngagementResponse = await sweep('AuditEngagementController_update', () =>
      superAgent
        .patch(`/api/v1/audits/${sweptAuditEngagementId}`)
        .set('Origin', appOrigin)
        .set('If-Match', sweptAuditEngagementEtag)
        .send({ objective: 'Objetivo revisado pelo sweep.' }),
    );

    await sweep('AuditEngagementScopeController_addFrameworkVersion', () =>
      superAgent
        .post(`/api/v1/audits/${sweptAuditEngagementId}/scope/framework-versions`)
        .set('Origin', appOrigin)
        .send({ frameworkVersionId: sweptVersionId }),
    );
    await sweep('AuditEngagementScopeController_addRequirement', () =>
      superAgent
        .post(`/api/v1/audits/${sweptAuditEngagementId}/scope/requirements`)
        .set('Origin', appOrigin)
        .send({ requirementId: sweptRequirementId }),
    );
    await sweep('AuditEngagementScopeController_addControl', () =>
      superAgent
        .post(`/api/v1/audits/${sweptAuditEngagementId}/scope/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: assessableControlId }),
    );
    await sweep('AuditEngagementScopeController_listScope', () =>
      superAgent.get(`/api/v1/audits/${sweptAuditEngagementId}/scope`).set('Origin', appOrigin),
    );

    const startEngagementResponse = await sweep('AuditEngagementLifecycleController_start', () =>
      superAgent
        .post(`/api/v1/audits/${sweptAuditEngagementId}/start`)
        .set('Origin', appOrigin)
        .set('If-Match', updateEngagementResponse.headers.etag ?? sweptAuditEngagementEtag),
    );

    await sweep('AuditEngagementFindingController_create', () =>
      superAgent
        .post(`/api/v1/audits/${sweptAuditEngagementId}/findings`)
        .set('Origin', appOrigin)
        .send({
          title: 'Achado do sweep de teste',
          description: 'Descrição do achado gerado pelo sweep.',
          category: 'NONCONFORMITY',
          origin: 'CONTROL_TESTING',
          severity: 'HIGH',
          priority: 'HIGH',
          ownerUserId: owner.id,
          identifiedOn: '2026-03-01',
        }),
    );
    await sweep('AuditEngagementFindingController_list', () =>
      superAgent.get(`/api/v1/audits/${sweptAuditEngagementId}/findings`).set('Origin', appOrigin),
    );

    await sweep('AuditEngagementLifecycleController_complete', () =>
      superAgent
        .post(`/api/v1/audits/${sweptAuditEngagementId}/complete`)
        .set('Origin', appOrigin)
        .set('If-Match', startEngagementResponse.headers.etag!),
    );

    const createCancelledEngagementResponse = await sweep('AuditEngagementController_create', () =>
      superAgent.post('/api/v1/audits').set('Origin', appOrigin).send({
        objective: 'Auditoria descartada pelo sweep.',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        orgUnitId,
        leadAuditorUserId: superUserId,
      }),
    );
    const sweptCancelledEngagementId = (createCancelledEngagementResponse.body as { id: string })
      .id;
    await sweep('AuditEngagementLifecycleController_cancel', () =>
      superAgent
        .post(`/api/v1/audits/${sweptCancelledEngagementId}/cancel`)
        .set('Origin', appOrigin)
        .set('If-Match', createCancelledEngagementResponse.headers.etag!)
        .send({ justification: 'Aberto por engano (sweep).' }),
    );

    await sweep('DashboardController_getDashboard', () =>
      superAgent.get('/api/v1/dashboard').set('Origin', appOrigin),
    );

    const createEvidenceResponse = await sweep('EvidenceController_create', () =>
      superAgent.post('/api/v1/evidence').set('Origin', appOrigin).send({
        orgUnitId,
        title: 'Evidência do sweep de teste',
        type: 'DOCUMENT',
        source: 'MANUAL_UPLOAD',
        ownerUserId: owner.id,
        collectedOn: '2026-03-01',
        observation: 'Observação de teste do sweep.',
      }),
    );
    const evidenceId = (createEvidenceResponse.body as { id: string }).id;

    await sweep('EvidenceController_list', () =>
      superAgent.get('/api/v1/evidence').set('Origin', appOrigin),
    );
    await sweep('EvidenceController_findById', () =>
      superAgent.get(`/api/v1/evidence/${evidenceId}`).set('Origin', appOrigin),
    );
    await sweep('EvidenceController_update', () =>
      superAgent
        .patch(`/api/v1/evidence/${evidenceId}`)
        .set('Origin', appOrigin)
        .send({ title: 'Evidência do sweep de teste (atualizada)' }),
    );

    const linkEvidenceResponse = await sweep('EvidenceController_link', () =>
      superAgent
        .post(`/api/v1/evidence/${evidenceId}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: riskId }),
    );
    const evidenceLinkId = (linkEvidenceResponse.body as { id: string }).id;

    await sweep('EvidenceController_listLinks', () =>
      superAgent.get(`/api/v1/evidence/${evidenceId}/links`).set('Origin', appOrigin),
    );
    await sweep('EvidenceController_unlink', () =>
      superAgent
        .post(`/api/v1/evidence/${evidenceId}/links/${evidenceLinkId}/unlink`)
        .set('Origin', appOrigin),
    );
    await sweep('EvidenceController_archive', () =>
      superAgent.post(`/api/v1/evidence/${evidenceId}/archive`).set('Origin', appOrigin),
    );

    const createSharedActionResponse = await sweep('ActionController_create', () =>
      superAgent.post('/api/v1/actions').set('Origin', appOrigin).send({
        originType: 'RISK_TREATMENT',
        originId: riskId,
        title: 'Ação do sweep de teste',
        responsibleUserId: owner.id,
        dueOn: '2026-06-01',
      }),
    );
    const sharedActionId = (createSharedActionResponse.body as { id: string }).id;

    await sweep('ActionController_list', () =>
      superAgent.get('/api/v1/actions').set('Origin', appOrigin),
    );
    await sweep('ActionController_findById', () =>
      superAgent.get(`/api/v1/actions/${sharedActionId}`).set('Origin', appOrigin),
    );
    await sweep('ActionController_update', () =>
      superAgent
        .patch(`/api/v1/actions/${sharedActionId}`)
        .set('Origin', appOrigin)
        .send({ title: 'Ação do sweep de teste (atualizada)' }),
    );
    await sweep('ActionController_transition', () =>
      superAgent
        .post(`/api/v1/actions/${sharedActionId}/transitions`)
        .set('Origin', appOrigin)
        .send({ to: 'IN_PROGRESS' }),
    );
    await sweep('ActionAuditController_list', () =>
      superAgent.get(`/api/v1/actions/${sharedActionId}/audit-events`).set('Origin', appOrigin),
    );

    const createFindingResponse = await sweep('FindingController_create', () =>
      superAgent.post('/api/v1/findings').set('Origin', appOrigin).send({
        orgUnitId,
        title: 'Achado do sweep de teste',
        description: 'Descrição do achado do sweep de teste.',
        category: 'NONCONFORMITY',
        origin: 'INTERNAL_ASSESSMENT',
        severity: 'HIGH',
        priority: 'HIGH',
        ownerUserId: owner.id,
        identifiedOn: '2026-03-01',
      }),
    );
    const findingId = (createFindingResponse.body as { id: string }).id;

    await sweep('FindingController_list', () =>
      superAgent.get('/api/v1/findings').set('Origin', appOrigin),
    );
    await sweep('FindingController_findById', () =>
      superAgent.get(`/api/v1/findings/${findingId}`).set('Origin', appOrigin),
    );
    await sweep('FindingController_update', () =>
      superAgent
        .patch(`/api/v1/findings/${findingId}`)
        .set('Origin', appOrigin)
        .send({ title: 'Achado do sweep de teste (atualizado)' }),
    );

    await sweep('FindingController_startRemediation', () =>
      superAgent.post(`/api/v1/findings/${findingId}/start-remediation`).set('Origin', appOrigin),
    );

    await sweep('FindingRelationshipController_listControlLinks', () =>
      superAgent.get(`/api/v1/findings/${findingId}/controls`).set('Origin', appOrigin),
    );
    const findingLinkControlResponse = await sweep(
      'FindingRelationshipController_linkControl',
      () =>
        superAgent
          .post(`/api/v1/findings/${findingId}/controls`)
          .set('Origin', appOrigin)
          .send({ controlId }),
    );
    const findingControlLinkId = (findingLinkControlResponse.body as { id: string }).id;
    await sweep('FindingRelationshipController_unlinkControl', () =>
      superAgent
        .delete(`/api/v1/findings/${findingId}/controls/${findingControlLinkId}`)
        .set('Origin', appOrigin),
    );
    await sweep('FindingRelationshipController_listRiskLinks', () =>
      superAgent.get(`/api/v1/findings/${findingId}/risks`).set('Origin', appOrigin),
    );
    const findingLinkRiskResponse = await sweep('FindingRelationshipController_linkRisk', () =>
      superAgent
        .post(`/api/v1/findings/${findingId}/risks`)
        .set('Origin', appOrigin)
        .send({ riskId }),
    );
    const findingRiskLinkId = (findingLinkRiskResponse.body as { id: string }).id;
    await sweep('FindingRelationshipController_unlinkRisk', () =>
      superAgent
        .delete(`/api/v1/findings/${findingId}/risks/${findingRiskLinkId}`)
        .set('Origin', appOrigin),
    );

    const sweepEvidenceResponse = await superAgent
      .post('/api/v1/evidence')
      .set('Origin', appOrigin)
      .send({
        orgUnitId,
        title: 'Evidência do sweep de teste (achado)',
        type: 'DOCUMENT',
        source: 'MANUAL_UPLOAD',
        ownerUserId: owner.id,
        collectedOn: '2026-03-01',
        observation:
          'Evidência para satisfazer a Invariante F5 (FR-010) no fluxo de fechamento do sweep.',
      });
    const sweepEvidenceId = (sweepEvidenceResponse.body as { id: string }).id;
    await superAgent
      .post(`/api/v1/evidence/${sweepEvidenceId}/links`)
      .set('Origin', appOrigin)
      .send({ subjectType: 'FINDING', subjectId: findingId });

    await sweep('FindingController_close', () =>
      superAgent
        .post(`/api/v1/findings/${findingId}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado pelo sweep de teste.' }),
    );
    await sweep('FindingController_reopen', () =>
      superAgent
        .post(`/api/v1/findings/${findingId}/reopen`)
        .set('Origin', appOrigin)
        .send({ reason: 'Reaberto pelo sweep de teste.' }),
    );
    await sweep('FindingController_close', () =>
      superAgent
        .post(`/api/v1/findings/${findingId}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado novamente pelo sweep de teste.' }),
    );
    await sweep('FindingController_archive', () =>
      superAgent.post(`/api/v1/findings/${findingId}/archive`).set('Origin', appOrigin),
    );

    const createIncidentResponse = await sweep('IncidentController_create', () =>
      superAgent.post('/api/v1/incidents').set('Origin', appOrigin).send({
        title: 'Incidente do sweep de teste',
        description: 'Descrição do incidente do sweep de teste.',
        severity: 'HIGH',
        orgUnitId,
        reportedOn: '2026-03-01',
        ownerUserId: owner.id,
      }),
    );
    const incidentId = (createIncidentResponse.body as { id: string }).id;

    await sweep('IncidentController_list', () =>
      superAgent.get('/api/v1/incidents').set('Origin', appOrigin),
    );
    await sweep('IncidentController_findById', () =>
      superAgent.get(`/api/v1/incidents/${incidentId}`).set('Origin', appOrigin),
    );
    await sweep('IncidentController_update', () =>
      superAgent
        .patch(`/api/v1/incidents/${incidentId}`)
        .set('Origin', appOrigin)
        .send({ description: 'Descrição do incidente do sweep de teste (atualizada).' }),
    );
    await sweep('IncidentController_transition', () =>
      superAgent
        .post(`/api/v1/incidents/${incidentId}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_PROGRESS' }),
    );

    await sweep('IncidentRelationshipController_listRiskLinks', () =>
      superAgent.get(`/api/v1/incidents/${incidentId}/risks`).set('Origin', appOrigin),
    );
    const incidentLinkRiskResponse = await sweep('IncidentRelationshipController_linkRisk', () =>
      superAgent
        .post(`/api/v1/incidents/${incidentId}/risks`)
        .set('Origin', appOrigin)
        .send({ riskId }),
    );
    const incidentRiskLinkId = (incidentLinkRiskResponse.body as { id: string }).id;
    await sweep('RiskRelationshipController_listIncidentLinks', () =>
      superAgent.get(`/api/v1/risks/${riskId}/incidents`).set('Origin', appOrigin),
    );
    await sweep('IncidentRelationshipController_unlinkRisk', () =>
      superAgent
        .delete(`/api/v1/incidents/${incidentId}/risks/${incidentRiskLinkId}`)
        .set('Origin', appOrigin),
    );

    await sweep('IncidentRelationshipController_listAssetLinks', () =>
      superAgent.get(`/api/v1/incidents/${incidentId}/assets`).set('Origin', appOrigin),
    );
    const incidentLinkAssetResponse = await sweep('IncidentRelationshipController_linkAsset', () =>
      superAgent
        .post(`/api/v1/incidents/${incidentId}/assets`)
        .set('Origin', appOrigin)
        .send({ assetId }),
    );
    const incidentAssetLinkId = (incidentLinkAssetResponse.body as { id: string }).id;
    await sweep('AssetController_listIncidentLinks', () =>
      superAgent.get(`/api/v1/assets/${assetId}/incidents`).set('Origin', appOrigin),
    );
    await sweep('IncidentRelationshipController_unlinkAsset', () =>
      superAgent
        .delete(`/api/v1/incidents/${incidentId}/assets/${incidentAssetLinkId}`)
        .set('Origin', appOrigin),
    );

    await sweep('IncidentRelationshipController_listProcessLinks', () =>
      superAgent.get(`/api/v1/incidents/${incidentId}/processes`).set('Origin', appOrigin),
    );
    const incidentLinkProcessResponse = await sweep(
      'IncidentRelationshipController_linkProcess',
      () =>
        superAgent
          .post(`/api/v1/incidents/${incidentId}/processes`)
          .set('Origin', appOrigin)
          .send({ processId }),
    );
    const incidentProcessLinkId = (incidentLinkProcessResponse.body as { id: string }).id;
    await sweep('ProcessController_listIncidentLinks', () =>
      superAgent.get(`/api/v1/processes/${processId}/incidents`).set('Origin', appOrigin),
    );
    await sweep('IncidentRelationshipController_unlinkProcess', () =>
      superAgent
        .delete(`/api/v1/incidents/${incidentId}/processes/${incidentProcessLinkId}`)
        .set('Origin', appOrigin),
    );

    const createProblemResponse = await sweep('ProblemController_create', () =>
      superAgent.post('/api/v1/problems').set('Origin', appOrigin).send({
        title: 'Problema do sweep de teste',
        description: 'Descrição do problema do sweep de teste.',
        severity: 'HIGH',
        orgUnitId,
        identifiedOn: '2026-03-01',
        ownerUserId: owner.id,
      }),
    );
    const problemId = (createProblemResponse.body as { id: string }).id;

    await sweep('ProblemController_list', () =>
      superAgent.get('/api/v1/problems').set('Origin', appOrigin),
    );
    await sweep('ProblemController_findById', () =>
      superAgent.get(`/api/v1/problems/${problemId}`).set('Origin', appOrigin),
    );
    await sweep('ProblemController_update', () =>
      superAgent
        .patch(`/api/v1/problems/${problemId}`)
        .set('Origin', appOrigin)
        .send({ description: 'Descrição do problema do sweep de teste (atualizada).' }),
    );
    await sweep('ProblemController_transition', () =>
      superAgent
        .post(`/api/v1/problems/${problemId}/transitions`)
        .set('Origin', appOrigin)
        .send({ toStatus: 'IN_ANALYSIS' }),
    );

    await sweep('ProblemRelationshipController_listRiskLinks', () =>
      superAgent.get(`/api/v1/problems/${problemId}/risks`).set('Origin', appOrigin),
    );
    const problemLinkRiskResponse = await sweep('ProblemRelationshipController_linkRisk', () =>
      superAgent
        .post(`/api/v1/problems/${problemId}/risks`)
        .set('Origin', appOrigin)
        .send({ riskId }),
    );
    const problemRiskLinkId = (problemLinkRiskResponse.body as { id: string }).id;
    await sweep('RiskRelationshipController_listProblemLinks', () =>
      superAgent.get(`/api/v1/risks/${riskId}/problems`).set('Origin', appOrigin),
    );
    await sweep('ProblemRelationshipController_unlinkRisk', () =>
      superAgent
        .delete(`/api/v1/problems/${problemId}/risks/${problemRiskLinkId}`)
        .set('Origin', appOrigin),
    );

    await sweep('ProblemRelationshipController_listIncidentLinks', () =>
      superAgent.get(`/api/v1/problems/${problemId}/incidents`).set('Origin', appOrigin),
    );
    const problemLinkIncidentResponse = await sweep(
      'ProblemRelationshipController_linkIncident',
      () =>
        superAgent
          .post(`/api/v1/problems/${problemId}/incidents`)
          .set('Origin', appOrigin)
          .send({ incidentId }),
    );
    const problemIncidentLinkId = (problemLinkIncidentResponse.body as { id: string }).id;
    await sweep('IncidentRelationshipController_listProblemLinks', () =>
      superAgent.get(`/api/v1/incidents/${incidentId}/problems`).set('Origin', appOrigin),
    );
    await sweep('ProblemRelationshipController_unlinkIncident', () =>
      superAgent
        .delete(`/api/v1/problems/${problemId}/incidents/${problemIncidentLinkId}`)
        .set('Origin', appOrigin),
    );

    const createIndicatorResponse = await sweep('IndicatorController_create', () =>
      superAgent.post('/api/v1/indicators').set('Origin', appOrigin).send({
        metricKey: 'RISK_TOTAL_BY_LEVEL',
        name: 'Indicador do sweep de teste',
        description: 'Descrição do indicador de teste do sweep.',
        ownerUserId: owner.id,
        thresholdComparator: 'GTE',
        thresholdValue: 1,
      }),
    );
    const sweepIndicatorDefinitionId = (createIndicatorResponse.body as { id: string }).id;

    await sweep('IndicatorController_list', () =>
      superAgent.get('/api/v1/indicators').set('Origin', appOrigin),
    );
    await sweep('IndicatorController_getById', () =>
      superAgent.get(`/api/v1/indicators/${sweepIndicatorDefinitionId}`).set('Origin', appOrigin),
    );
    await sweep('IndicatorController_update', () =>
      superAgent
        .patch(`/api/v1/indicators/${sweepIndicatorDefinitionId}`)
        .set('Origin', appOrigin)
        .send({ name: 'Indicador do sweep de teste (editado)' }),
    );
    await sweep('IndicatorController_getCurrentValue', () =>
      superAgent.get('/api/v1/indicators/RISK_TOTAL_BY_LEVEL/current').set('Origin', appOrigin),
    );
    await sweep('IndicatorController_listMetricKeys', () =>
      superAgent.get('/api/v1/indicators/metric-keys').set('Origin', appOrigin),
    );

    await sweep('IndicatorController_createMeasurement', () =>
      superAgent
        .post('/api/v1/indicators/RISK_TOTAL_BY_LEVEL/measurements')
        .set('Origin', appOrigin)
        .send({}),
    );
    await sweep('IndicatorController_listMeasurements', () =>
      superAgent
        .get('/api/v1/indicators/RISK_TOTAL_BY_LEVEL/measurements')
        .set('Origin', appOrigin),
    );

    const createReportResponse = await sweep('ReportController_create', () =>
      superAgent
        .post('/api/v1/reports')
        .set('Origin', appOrigin)
        .send({
          name: 'Relatório do sweep de teste',
          description: 'Descrição do relatório de teste do sweep.',
          metricKeys: ['RISK_TOTAL_BY_LEVEL', 'CONTROL_INACTIVE_COUNT'],
        }),
    );
    const sweepReportId = (createReportResponse.body as { id: string }).id;

    await sweep('ReportController_list', () =>
      superAgent.get('/api/v1/reports').set('Origin', appOrigin),
    );
    await sweep('ReportController_getById', () =>
      superAgent.get(`/api/v1/reports/${sweepReportId}`).set('Origin', appOrigin),
    );
    await sweep('ReportController_update', () =>
      superAgent
        .patch(`/api/v1/reports/${sweepReportId}`)
        .set('Origin', appOrigin)
        .send({ name: 'Relatório do sweep de teste (editado)' }),
    );
    await sweep('ReportController_run', () =>
      superAgent.get(`/api/v1/reports/${sweepReportId}/run`).set('Origin', appOrigin),
    );
    await sweep('ReportController_run', () =>
      superAgent
        .get(`/api/v1/reports/${sweepReportId}/run`)
        .query({ format: 'csv' })
        .set('Origin', appOrigin),
    );

    await sweep('DashboardSummaryController_getSummary', () =>
      superAgent.get('/api/v1/dashboard/summary').set('Origin', appOrigin),
    );

    const createCommentResponse = await sweep('CommentController_create', () =>
      superAgent
        .post('/api/v1/comments')
        .set('Origin', appOrigin)
        .send({ entityType: 'RISK', entityId: riskId, body: 'Comentário de teste do sweep.' }),
    );
    commentId = (createCommentResponse.body as { id: string }).id;
    await sweep('CommentController_list', () =>
      superAgent
        .get('/api/v1/comments')
        .query({ entityType: 'RISK', entityId: riskId })
        .set('Origin', appOrigin),
    );

    const uploadResponse = await sweep('AttachmentController_upload', () =>
      superAgent
        .post('/api/v1/attachments')
        .set('Origin', appOrigin)
        .field('entityType', 'RISK')
        .field('entityId', riskId)
        .attach('file', Buffer.from('%PDF-1.7\nconteúdo de teste do sweep', 'utf-8'), {
          filename: 'sweep.pdf',
          contentType: 'application/pdf',
        }),
    );
    attachmentId = (uploadResponse.body as { id: string }).id;
    await sweep('AttachmentController_list', () =>
      superAgent
        .get('/api/v1/attachments')
        .query({ entityType: 'RISK', entityId: riskId })
        .set('Origin', appOrigin),
    );
    await sweep('AttachmentController_downloadContent', () =>
      superAgent.get(`/api/v1/attachments/${attachmentId}/content`).set('Origin', appOrigin),
    );

    await sweep('CommentController_withdraw', () =>
      superAgent.delete(`/api/v1/comments/${commentId}`).set('Origin', appOrigin),
    );
    await sweep('AttachmentController_withdraw', () =>
      superAgent.delete(`/api/v1/attachments/${attachmentId}`).set('Origin', appOrigin),
    );

    await sweep('NotificationController_list', () =>
      superAgent.get('/api/v1/notifications').set('Origin', appOrigin),
    );
    await sweep('NotificationController_markRead', () =>
      superAgent.post(`/api/v1/notifications/${notificationId}/read`).set('Origin', appOrigin),
    );
    await sweep('NotificationController_markAllRead', () =>
      superAgent
        .post('/api/v1/notifications')
        .set('Origin', appOrigin)
        .send({ action: 'MARK_ALL_READ' }),
    );

    const createOrgUnitResponse = await sweep('AdminOrgUnitsController_create', () =>
      superAgent
        .post('/api/v1/admin/org-units')
        .set('Origin', appOrigin)
        .send({
          code: uniqueTestMarker('info-disclosure-admin-ou'),
          name: 'Unidade de teste (sweep)',
        }),
    );
    disposableOrgUnitId = (createOrgUnitResponse.body as { id: string }).id;
    await sweep('AdminOrgUnitsController_list', () =>
      superAgent.get('/api/v1/admin/org-units').set('Origin', appOrigin),
    );
    await sweep('AdminOrgUnitsController_findById', () =>
      superAgent.get(`/api/v1/admin/org-units/${disposableOrgUnitId}`).set('Origin', appOrigin),
    );
    await sweep('AdminOrgUnitsController_update', () =>
      superAgent
        .patch(`/api/v1/admin/org-units/${disposableOrgUnitId}`)
        .set('Origin', appOrigin)
        .send({ name: 'Unidade de teste (sweep, atualizada)' }),
    );
    await sweep('AdminOrgUnitsController_setStatus', () =>
      superAgent
        .put(`/api/v1/admin/org-units/${disposableOrgUnitId}/status`)
        .set('Origin', appOrigin)
        .send({ status: 'INACTIVE' }),
    );

    await sweep('AdminPermissionsController_list', () =>
      superAgent.get('/api/v1/admin/permissions').set('Origin', appOrigin),
    );

    const createRoleResponse = await sweep('AdminRolesController_create', () =>
      superAgent
        .post('/api/v1/admin/roles')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('info-disclosure-admin-role'),
          description: 'Papel de teste do sweep.',
          permissionIdentifiers: ['risk:view'],
        }),
    );
    disposableRoleId = (createRoleResponse.body as { id: string }).id;
    await sweep('AdminRolesController_list', () =>
      superAgent.get('/api/v1/admin/roles').set('Origin', appOrigin),
    );
    await sweep('AdminRolesController_findById', () =>
      superAgent.get(`/api/v1/admin/roles/${disposableRoleId}`).set('Origin', appOrigin),
    );
    await sweep('AdminRolesController_summary', () =>
      superAgent.get('/api/v1/admin/roles/summary').set('Origin', appOrigin),
    );
    await sweep('AdminRolesController_update', () =>
      superAgent
        .patch(`/api/v1/admin/roles/${disposableRoleId}`)
        .set('Origin', appOrigin)
        .send({ description: 'Papel de teste do sweep (atualizado).' }),
    );

    const createUserResponse = await sweep('AdminUsersController_create', () =>
      superAgent
        .post('/api/v1/admin/users')
        .set('Origin', appOrigin)
        .send({
          email: `${uniqueTestMarker('info-disclosure-admin-user')}@example.test`,
          fullName: 'Usuário administrado (sweep)',
          primaryOrgUnitId: orgUnitId,
          initialPassword: 'Sweep-Disposable-Passw0rd!',
        }),
    );
    adminTargetUserId = (createUserResponse.body as { id: string }).id;
    await sweep('AdminUsersController_list', () =>
      superAgent.get('/api/v1/admin/users').set('Origin', appOrigin),
    );
    await sweep('AdminUsersController_findById', () =>
      superAgent.get(`/api/v1/admin/users/${adminTargetUserId}`).set('Origin', appOrigin),
    );
    await sweep('AdminUsersController_update', () =>
      superAgent
        .patch(`/api/v1/admin/users/${adminTargetUserId}`)
        .set('Origin', appOrigin)
        .send({ fullName: 'Usuário administrado (sweep, atualizado)' }),
    );
    await sweep('AdminUsersController_replaceRoles', () =>
      superAgent
        .put(`/api/v1/admin/users/${adminTargetUserId}/roles`)
        .set('Origin', appOrigin)
        .send({ roleIds: [disposableRoleId] }),
    );
    await sweep('AdminUserScopeGrantsController_list', () =>
      superAgent
        .get(`/api/v1/admin/users/${adminTargetUserId}/scope-grants`)
        .set('Origin', appOrigin),
    );
    const grantResponse = await sweep('AdminUserScopeGrantsController_grant', () =>
      superAgent
        .post(`/api/v1/admin/users/${adminTargetUserId}/scope-grants`)
        .set('Origin', appOrigin)
        .send({ scopeType: 'UNIT', orgUnitId }),
    );
    adminScopeGrantId = (grantResponse.body as { id: string }).id;
    await sweep('AdminUserScopeGrantsController_revoke', () =>
      superAgent
        .delete(`/api/v1/admin/users/${adminTargetUserId}/scope-grants/${adminScopeGrantId}`)
        .set('Origin', appOrigin),
    );
    await sweep('AdminUsersController_resetPassword', () =>
      superAgent
        .put(`/api/v1/admin/users/${adminTargetUserId}/password`)
        .set('Origin', appOrigin)
        .send({ newPassword: 'Sweep-Disposable-Reset-Passw0rd!' }),
    );
    await sweep('AdminUsersController_setStatus', () =>
      superAgent
        .put(`/api/v1/admin/users/${adminTargetUserId}/status`)
        .set('Origin', appOrigin)
        .send({ status: 'INACTIVE', reason: 'Teste do sweep de divulgação de informações.' }),
    );
    await sweep('AdminUsersController_revokeSessions', () =>
      superAgent
        .delete(`/api/v1/admin/users/${adminTargetUserId}/sessions`)
        .set('Origin', appOrigin),
    );

    await superAgent
      .put(`/api/v1/admin/users/${adminTargetUserId}/roles`)
      .set('Origin', appOrigin)
      .send({ roleIds: [] });
    await sweep('AdminRolesController_delete', () =>
      superAgent.delete(`/api/v1/admin/roles/${disposableRoleId}`).set('Origin', appOrigin),
    );

    await sweep('AuthController_changeOwnPassword', () =>
      disposableAgent.post('/api/v1/auth/me/password').set('Origin', appOrigin).send({
        currentPassword: disposableUser.rawPassword,
        newPassword: 'Sweep-Disposable-Changed-Passw0rd!',
      }),
    );
    await sweep('AuthController_logout', () =>
      disposableAgent.post('/api/v1/auth/logout').set('Origin', appOrigin),
    );
  }

  it('swept every operation apps/api/openapi.json declares — exhaustiveness, not a sample', () => {
    const declared = loadOpenApiOperations();
    const declaredIds = declared.map((op) => op.operationId).sort();
    const sweptIds = Array.from(sweptOperationIds).sort();

    expect(sweptIds).toEqual(declaredIds);
    expect(declared.length).toBeGreaterThanOrEqual(40);
  });

  it('no HTTP response body contains a secret, token, session id, stack trace or internal identifier', () => {
    const httpViolations = violations.filter(
      (violation) =>
        !violation.location.startsWith('log:') && !violation.location.startsWith('audit_event:'),
    );
    expect(httpViolations).toEqual([]);
  });

  it('no captured operational log payload contains a secret, token, session id, stack trace or internal identifier', () => {
    expect(capturedLogCalls.length).toBeGreaterThan(0);
    for (const [index, call] of capturedLogCalls.entries()) {
      scanJsonValue(
        `log:${String(index)}:${call.level}:${call.message}`,
        undefined,
        call.payload,
        'log',
      );
    }
    const logViolations = violations.filter((violation) => violation.location.startsWith('log:'));
    expect(logViolations).toEqual([]);
  });

  it('no audit_event row written during the sweep contains a secret, token, session id, stack trace or internal identifier', async () => {
    const rows = await prisma.client.auditEvent.findMany({
      where: { occurredAt: { gte: sweepStartedAt } },
      select: {
        id: true,
        action: true,
        actorLabel: true,
        entityType: true,
        entityId: true,
        previousValues: true,
        newValues: true,
        ipAddress: true,
        userAgent: true,
        sessionId: true,
        correlationId: true,
      },
    });
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      scanJsonValue(
        `audit_event:${row.id}`,
        undefined,
        {
          action: row.action,
          actorLabel: row.actorLabel,
          entityType: row.entityType,
          entityId: row.entityId,
          previousValues: row.previousValues,
          newValues: row.newValues,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          correlationId: row.correlationId,
        },
        'audit',
      );
      if (row.sessionId) {
        for (const pattern of DISCLOSURE_PATTERNS) {
          expect(pattern.regex.test(row.sessionId)).toBe(false);
        }
      }
    }
    const auditViolations = violations.filter((violation) =>
      violation.location.startsWith('audit_event:'),
    );
    expect(auditViolations).toEqual([]);
  });

  it('reports every violation found, with location and pattern, if the sweep above failed', () => {
    if (violations.length > 0) {
      console.error(
        '[information-disclosure] violations found:',
        JSON.stringify(violations, null, 2),
      );
    }
    expect(violations).toEqual([]);
  });
});

describe('sanitizeLogMeta — the redaction mechanism itself (defense in depth, ADR-012)', () => {
  it('redacts every sensitive-looking key regardless of nesting, and leaves everything else untouched', () => {
    const input = {
      action: 'auth.login_failed',
      password: 'correct horse battery staple',
      newPassword: 'another-one',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$...',
      sessionToken: 'raw-token-value',
      SessionId: 'abc-123',
      apiKey: 'sk-fixture-not-a-real-key',
      credential: { nested: 'still redacted' },
      authorization: 'Bearer abc.def.ghi',
      cookie: 'pharos_session=abc',
      nested: {
        anotherSecretHash: 'value',
        harmless: 'kept',
        deeplyNested: [{ token: 'value' }, { fine: 'kept' }],
      },
      correlationId: 'kept-because-not-sensitive',
      actorUserId: 'kept-because-not-sensitive',
    };

    const output = sanitizeLogMeta(input) as Record<string, unknown>;

    expect(output.password).toBe('[REDACTED]');
    expect(output.newPassword).toBe('[REDACTED]');
    expect(output.passwordHash).toBe('[REDACTED]');
    expect(output.sessionToken).toBe('[REDACTED]');
    expect(output.SessionId).toBe('[REDACTED]');
    expect(output.apiKey).toBe('[REDACTED]');
    expect(output.credential).toBe('[REDACTED]');
    expect(output.authorization).toBe('[REDACTED]');
    expect(output.cookie).toBe('[REDACTED]');
    expect(output.correlationId).toBe('kept-because-not-sensitive');
    expect(output.actorUserId).toBe('kept-because-not-sensitive');

    const nested = output.nested as Record<string, unknown>;
    expect(nested.anotherSecretHash).toBe('[REDACTED]');
    expect(nested.harmless).toBe('kept');
    const deeplyNested = nested.deeplyNested as Record<string, unknown>[];
    expect(deeplyNested[0]!.token).toBe('[REDACTED]');
    expect(deeplyNested[1]!.fine).toBe('kept');

    scanJsonValue('sanitizeLogMeta-output', undefined, output);
  });
});
