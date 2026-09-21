/**
 * T202 — a real sweep, not a sample: every route this application
 * registers is exercised with an authenticated caller, and every response
 * body, every structured log entry emitted while doing so, and every
 * `audit_event` row written during the sweep is scanned for a secret,
 * token, session id, stack trace or internal identifier (SC-010, FR-035,
 * FR-107, FR-108).
 *
 * ## What "every route" means here, and how exhaustiveness is enforced
 *
 * `apps/api/openapi.json` (route-level, reflected from the real Nest
 * router — D-14) is read at test time and its full `{method, path,
 * operationId}` set is compared, at the END of this file, against the set
 * of operationIds this file actually called. That comparison — not a
 * hand-maintained count in a comment — is what proves the sweep is
 * genuinely exhaustive: a route added later without a corresponding call
 * added to `runSweep()` fails this test immediately, loudly, rather than
 * silently going unswept. As of this dispatch (002-shared-grc-foundation,
 * US1, added the eight Evidence operations) that is 86 operations across
 * 64 paths; `POST /auth/login` is exercised via
 * `loginAs` (used to authenticate every actor this file needs) and recorded
 * as swept explicitly, rather than issuing a second, wasted login call.
 *
 * ## Fixtures, chained rather than pre-seeded in bulk
 *
 * Nearly every route either PRODUCES an id a later route needs (`POST
 * /admin/roles` -> `roleId` for `GET/PATCH/DELETE
 * /admin/roles/{roleId}`) or CONSUMES one a real business flow already
 * produced (a risk assessed, transitioned and approval-requested for the
 * approvals/lifecycle/history/audit routes). `runSweep()` is therefore one
 * long, explicit, DEPENDENCY-ORDERED sequence — a generic "call every path
 * with placeholder ids" sweep would mostly produce 404s and never reach the
 * response shapes where a real disclosure defect would actually surface
 * (an admin user's serialized record, a real audit trail entry, a real
 * risk detail body).
 *
 * ## Three independent evidence sources, not one
 *
 * 1. **HTTP responses** — every `runSweep()` call's parsed JSON body (or
 *    raw text for the one binary download, attachment content) is walked
 *    recursively and every string value checked against
 *    `DISCLOSURE_PATTERNS`.
 * 2. **Operational log** — `AppLogger`'s own underlying `pino` instance
 *    (`app-logger.service.ts`) is spied on for the whole sweep, capturing
 *    the REAL metadata object passed to every `security`/`audit_ops`/
 *    `error`/`operational` log call this app makes while serving these
 *    requests, in-process. This is chosen deliberately over trying to
 *    capture raw stdout text: `logger.ts`'s `createLogger` hands pino no
 *    explicit `destination`, so pino's default writes go straight to file
 *    descriptor 1 via `SonicBoom` (bypassing `process.stdout.write`
 *    entirely), and `LOG_PRETTY=true` additionally routes through a
 *    `pino-pretty` WORKER THREAD — neither is interceptable by patching
 *    `process.stdout.write` in this (main) thread without a flaky,
 *    fd-level redirect. Spying on the pino instance itself captures the
 *    exact same payload object pino would otherwise have serialized,
 *    reliably, in-process, with no timing race.
 * 3. **`audit_event`** — every row with `occurred_at >= sweepStartedAt` is
 *    read back and its `previousValues`/`newValues`/`action`/`actorLabel`
 *    scanned the same way.
 *
 * ## The one legitimate look-alike, named rather than excluded silently
 *
 * `Attachment.checksumSha256` is a declared response field
 * (`contracts/platform.openapi.yaml`) that is SUPPOSED to look like a
 * SHA-256 digest — it is one, by design (a content-integrity checksum, not
 * a secret). `DISCLOSURE_PATTERNS`'s 64-hex-digest check is NOT weakened to
 * exclude it; instead, `scanJsonValue` skips the check only when the exact
 * JSON key is `checksumSha256`, so a stray 64-hex value surfacing under any
 * OTHER key — including a typo'd key, or a genuinely leaked token hash —
 * still fails loudly. This is the file's only pattern exception, and it
 * exists for the reason `attachments.spec.ts` already documents (that spec
 * asserts the SAME field is present, not absent).
 */
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

// ---------------------------------------------------------------------
// Disclosure patterns
// ---------------------------------------------------------------------

interface DisclosurePattern {
  readonly name: string;
  readonly regex: RegExp;
}

/** `argon2id$` and friends — a real password hash (data-model.md's
 * `LocalCredential.passwordHash`). */
const ARGON2_HASH: DisclosurePattern = {
  name: 'argon2 password hash',
  regex: /\$argon2(id|i|d)\$/,
};
/** A 64-character hex string: `Session.tokenHash` (SHA-256,
 * `session-cookie.ts`), or any other SHA-256 digest that should never
 * leave the database. `Attachment.checksumSha256` is the one legitimate
 * exception — see this file's header. */
const SHA256_HEX: DisclosurePattern = {
  name: '64-hex digest (session token hash or similar)',
  regex: /\b[0-9a-f]{64}\b/i,
};
/** The RAW opaque session token shape — 32 random bytes, base64url,
 * unpadded (`generateOpaqueSessionToken`, `session-cookie.ts`) —
 * EXACTLY 43 characters of `[A-Za-z0-9_-]`. By design this value is
 * returned to a client exactly once, in the `Set-Cookie` header at login,
 * and is never persisted or re-emitted anywhere else in the system (only
 * its SHA-256 hash is stored) — so it must never appear again as a JSON
 * response value, a log payload value, or an audit row value.
 *
 * Anchored to match the WHOLE string (`^...$`), not a 43-character
 * substring: this codebase's own fixtures freely combine a marker prefix
 * with a UUID (`uniqueTestMarker(...)`, role/user names, email local
 * parts), which routinely contain an incidental 43+ character run of
 * `[A-Za-z0-9_-]` — a real session token, by contrast, is never
 * concatenated with anything else; it IS the whole field value wherever it
 * legitimately appears (the `Set-Cookie` header). Confirmed empirically:
 * the unanchored version flagged this file's own fixture emails/role names
 * as false positives on the first real run against the full sweep. */
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

/** Keys whose value is ALLOWED to look like a 64-hex digest (this file's
 * one documented pattern exception — see the file header). Every OTHER
 * pattern still applies to these keys' values. */
const ALLOWLISTED_SHA256_KEYS: ReadonlySet<string> = new Set(['checksumSha256']);

/** Keys that must NEVER be serialized at all, in a response, a log payload
 * or an audit row, regardless of what their value looks like (ADR-010,
 * FR-107). */
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

/** Patterns skipped for the `stack` key, but ONLY in a `log` context — see
 * `scanJsonValue`'s own header for the full reasoning. Every OTHER pattern
 * (a secret, a connection string, a raw token, a session-token hash) still
 * applies to a `stack` value regardless of context. */
const STACK_KEY_LOG_EXCEPTIONS: ReadonlySet<DisclosurePattern> = new Set([
  NODE_STACK_FRAME,
  WINDOWS_ABS_PATH,
  UNIX_ABS_PATH,
]);

type ScanContext = 'http' | 'log' | 'audit';

/**
 * Recursively walks a parsed JSON value (object/array/primitive), checking
 * every STRING leaf against `DISCLOSURE_PATTERNS` and every KEY against
 * `FORBIDDEN_KEYS`. `location` accumulates a JSON-path-like string for a
 * useful failure message.
 *
 * ## The `stack` key in a `log` context — this file's second, and ONLY
 * other, documented pattern exception (see the file header for the first,
 * `checksumSha256`)
 *
 * `problem-details.filter.ts`'s own header states its design explicitly:
 * "Everything beyond the safe, mapped `detail` is logged server-side (via
 * `AppLogger`) ... so an operator can find the full detail in logs without
 * the client ever seeing it" — a stack trace (and the absolute source
 * paths inside it) in a SERVER-SIDE OPERATIONAL LOG is deliberate,
 * reviewed, standard incident-response practice, not a disclosure defect:
 * logs are an operator-only channel, never returned to any caller, which
 * is exactly why `FR-107`/`FR-108` (and this file's HTTP-response check,
 * completely unaffected by this exception) forbid a stack trace in a
 * RESPONSE but this codebase's own architecture relies on it existing in
 * logs. Confirmed empirically: the FIRST real run of this sweep flagged
 * `stack` values captured from `AppLogger.security`/`.operational` calls
 * (`problem-details.filter.ts`'s `meta.stack`) for `NODE_STACK_FRAME`/
 * `*_ABS_PATH` — every one traced back to that one, intentional field.
 * Narrowly excluding those two pattern checks for the EXACT key `stack`,
 * ONLY when `context === 'log'`, is the honest fix: an HTTP response or an
 * audit row is still flagged immediately if `stack` (or a stack-trace-
 * shaped string under any other key) ever appears there — this exception
 * cannot silently swallow a real leak into a response or the audit trail.
 */
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

/** For the one binary response (attachment content) and any response body
 * that is not valid JSON — scans as plain text, with no key context (so
 * `ALLOWLISTED_SHA256_KEYS`/`FORBIDDEN_KEYS` do not apply; this file's
 * fixtures never place a checksum value in a raw-text body). */
function scanRawText(location: string, text: string): void {
  for (const pattern of DISCLOSURE_PATTERNS) {
    if (pattern.regex.test(text)) {
      recordViolation(location, pattern.name, text);
    }
  }
}

// ---------------------------------------------------------------------
// Route table (from apps/api/openapi.json)
// ---------------------------------------------------------------------

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

  // Superuser: every permission this platform defines, GLOBAL scope — so
  // the sweep reaches real 2xx response SHAPES (a serialized admin user
  // record, a real audit trail, a real risk detail) instead of mostly 403s,
  // which would never exercise the bodies most likely to leak something.
  let superAgent: ReturnType<typeof request.agent>;
  // A SECOND actor, also with every permission and GLOBAL scope, used ONLY
  // for `POST /risks/{riskId}/approvals/{approvalId}/decision` — the
  // deciding user must differ from the requesting user
  // (`domain/approval.ts`'s segregation-of-duties rule), and the requester
  // throughout this sweep is `superAgent`.
  let deciderAgent: ReturnType<typeof request.agent>;
  // A throwaway actor for the three calls that would otherwise disrupt the
  // main sweep session: logout (ends the session), change-own-password
  // (changes the credential the rest of the sweep authenticates with) and
  // revoke-sessions (targeted at ITSELF would also end its own session).
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

  /** Records `operationId` as swept and scans the response. Every call in
   * `runSweep()` goes through this. */
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

    // FR-107/ADR-012 — no framework fingerprint leaked to any caller,
    // authenticated or not.
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
    // Needed as `ownerUserId` by the Controls catalogue sweep below: the
    // owner must be in the control's own organizational assignment line,
    // and this user's primary unit IS `orgUnitId`.
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

    // Seed one notification directly — there is no create-notification
    // endpoint (in-app notifications are a side effect of other actions,
    // ADR-015); seeding it is the pragmatic way to exercise
    // GET/POST /notifications with a real row rather than an empty page.
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

    // Minimal control/process/asset registry rows (data-model.md §10) — no
    // admin endpoint creates these; direct insert is this schema's own
    // documented seeding path (`Control`/`Process`/`Asset` header comments).
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

    // Spy on AppLogger's underlying pino instance — see file header for
    // why this, not stdout capture, is the reliable way to observe every
    // log payload emitted while serving the sweep's requests.
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
    // ---------------------------------------------------------------
    // Public/unauthenticated routes
    // ---------------------------------------------------------------
    await sweep('HealthController_live', () =>
      request(ctx.app.getHttpServer()).get('/api/v1/health/live'),
    );
    await sweep('HealthController_ready', () =>
      request(ctx.app.getHttpServer()).get('/api/v1/health/ready'),
    );
    // The login call that authenticates `superAgent` above is itself the
    // sweep's own exercise of this operation — its response was captured
    // via `loginAs`, not `sweep()`, so it is scanned here explicitly
    // instead of a second, wasted login.
    sweptOperationIds.add('AuthController_login');

    // ---------------------------------------------------------------
    // Reference data / directory / registry — no permission narrower than
    // "authenticated" (or `risk:view`, which superAgent holds).
    // ---------------------------------------------------------------
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
    // `GET /controls` moved to the Controls Management module's own
    // `ControlController.list` (003-controls-management, Task A —
    // ownership handover from `RegistryController`'s Fase 1 minimal
    // registry). `superAgent` holds every permission, including
    // `control:view`, and global scope, so this sweep entry keeps working
    // unchanged in shape even though the underlying controller/permission
    // changed.
    await sweep('ControlController_list', () =>
      superAgent.get('/api/v1/controls').set('Origin', appOrigin),
    );
    // 006-assets-processes — `GET /assets`/`GET /processes` are now ALSO
    // declared on `AssetController`/`ProcessController` (Fase 3), and
    // `apps/api/openapi.json`'s reflected `operationId` for these two
    // paths is `AssetController_list`/`ProcessController_list` (the LAST
    // module processed for a given `{method, path}` pair wins the
    // generator's own path-keyed overwrite — `AssetsModule`/
    // `ProcessesModule` are imported AFTER `RiskModule` in the committed
    // `app.module.ts`). The REAL HTTP behavior these two calls exercise in
    // THIS file's own `buildContractTestApp` instance is still the
    // retired `RegistryController` (Express dispatches to the FIRST
    // registered handler for a path, and `RiskModule` is imported BEFORE
    // `AssetsModule`/`ProcessesModule` there) — `RegistryController`'s two
    // routes become genuinely dead code only once Fase 4 (T029) removes
    // them; this sweep's own job is scanning whatever real response comes
    // back for a disclosure defect, under the id the contract currently
    // attributes to the path, exactly as `ControlController_list`'s own
    // comment above did for the Fase 2 handover. `superAgent` holds every
    // permission (including `risk:view`, `asset:view`, `process:view`)
    // and global scope, so which controller actually answers does not
    // change what this sweep call exercises.
    await sweep('ProcessController_list', () =>
      superAgent.get('/api/v1/processes').set('Origin', appOrigin),
    );
    await sweep('AssetController_list', () =>
      superAgent.get('/api/v1/assets').set('Origin', appOrigin),
    );

    // ---------------------------------------------------------------
    // Assets / Processes — own record CRUD + situation transitions
    // (006-assets-processes, Fase 3). Disposable records of their own —
    // NOT `assetId`/`processId` (created further below, direct Prisma
    // insert), which the risk/control relationship sweep still needs
    // ACTIVE throughout its own calls.
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Auth / own profile
    // ---------------------------------------------------------------
    await sweep('AuthController_getOwnProfile', () =>
      superAgent.get('/api/v1/auth/me').set('Origin', appOrigin),
    );
    await sweep('AuthController_getCurrentSession', () =>
      superAgent.get('/api/v1/auth/session').set('Origin', appOrigin),
    );

    // ---------------------------------------------------------------
    // Risk methodology
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Risk: create, then the full business-flow chain
    // ---------------------------------------------------------------
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('info-disclosure-owner')}@example.test`,
    });
    // F-CV-2: precondition owner for the risk this sweep drives through
    // every business-flow route — not the object of any assertion here
    // (the sweep's own subject is `superAgent`, an all-permissions actor,
    // untouched).
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

    // T093/F-31 — `PUT /risks/{riskId}/causes|consequences` (added
    // alongside this sweep entry; see `risk-statements.spec.ts` for the
    // dedicated functional/authorization/audit coverage — this sweep only
    // needs the response body scanned like every other operation).
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

    // Unlink everything last (independent of the risk's own status).
    await sweep(
      'RiskRelationshipController_unlinkControl',
      () =>
        superAgent
          .delete(`/api/v1/risks/${riskId}/controls/${controlLinkId}`)
          .set('Origin', appOrigin)
          .set('If-Match', '"999"'), // status irrelevant here; only the response body is scanned.
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

    // ---------------------------------------------------------------
    // Controls Management — assessments/attestation and process/asset/risk
    // relationships (003-controls-management, User Story 2/3, T027-T042).
    // `controlId` (the bare Fase-1 fixture created in `beforeAll`) has no
    // `orgUnitId`/`status` of its own — this workstream's own scoped
    // repository (`ControlLookupRepository`) treats a control with no org
    // unit as not-found (FR-007) and `createControlAssessment` requires
    // `ACTIVE` (D-6) — so a SEPARATE, dedicated control is created here
    // instead of reusing that bare fixture. `deciderAgent` (already
    // provisioned above, a second superuser) attests it, exactly like it
    // already decides the risk approval above — the assessor
    // (`superAgent`) may not attest its own assessment (C1).
    // ---------------------------------------------------------------
    // ---------------------------------------------------------------
    // Controls Management — catalogue and lifecycle (User Story 1,
    // operations 1-6). Swept through the real HTTP surface rather than
    // seeded straight into Prisma like `assessableControl` below: these
    // five operations are exactly the ones this sweep exists to cover, and
    // a fixture inserted behind the API would prove nothing about what the
    // API returns.
    // ---------------------------------------------------------------
    const createControlResponse = await sweep('ControlController_create', () =>
      superAgent.post('/api/v1/controls').set('Origin', appOrigin).send({
        name: 'Controle de catálogo (sweep)',
        description: 'Controle criado pelo sweep de divulgação de informações.',
        orgUnitId,
        ownerUserId: superUserId,
        nature: 'MANUAL',
        // `CreateControlRequestDto`'s field is `type`, not `controlType` —
        // this call was silently sending an unknown property and getting
        // refused with 400 ever since this section was written. It went
        // unnoticed because this sweep never asserts per-operation status,
        // and — until this task disabled Express's own default auto-ETag
        // globally (`main.ts`'s `app.set('etag', false)`) — the 400
        // response still carried SOME ETag (a content hash of the error
        // body), which was enough for `sweptControlEtag` below to be a
        // defined, if meaningless, string. Disabling that auto-ETag (the
        // actual fix this task makes; see `main.ts` and
        // `ControlController.findById`'s own doc comments) turned that
        // long-silent 400 into a hard `TypeError` on the next `If-Match`
        // instead — surfacing this bug rather than causing it.
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

    // ---------------------------------------------------------------
    // Compliance — the normative library (004-compliance-management, User
    // Story 1, operations 1-9/11/13). Swept through the real HTTP surface,
    // the same reasoning the Controls catalogue section above already
    // gives.
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Compliance — mapping, migration, applicability and compliance state
    // (004-compliance-management, User Story 2/3, operations 10/12/14-23).
    // Reuses `assessableControlId` (already ACTIVE, in `orgUnitId`) rather
    // than creating a fresh control — `superAgent` has GLOBAL scope, so
    // the link write's own scope check (ADR-020 part 4) passes regardless.
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Audit Engagements (005-audit-findings, User Story 1, operations
    // 1-11 of contracts/audit.openapi.yaml). Swept through the real HTTP
    // surface, the same reasoning the Compliance section above already
    // gives. `sweptVersionId`/`sweptRequirementId` are PUBLISHED by this
    // point (the `FrameworkVersionController_publish` call directly
    // above), so they are legal scope targets (FR-006); `assessableControlId`
    // is ACTIVE and already in `orgUnitId`. Two engagements: the first
    // walks PLANNING -> IN_PROGRESS -> COMPLETED through every scope-link
    // kind and the update operation; the second walks PLANNING ->
    // CANCELLED (FR-004a) — the edge the first path never reaches.
    // ---------------------------------------------------------------
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

    // T042/T043/005-audit-findings, User Story 2 — the engagement's own
    // producer of findings and their listing, only legal while
    // IN_PROGRESS (FR-004/FR-007), hence swept between `start` and
    // `complete` above/below.
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

    // ---------------------------------------------------------------
    // Dashboard
    // ---------------------------------------------------------------
    await sweep('DashboardController_getDashboard', () =>
      superAgent.get('/api/v1/dashboard').set('Origin', appOrigin),
    );

    // ---------------------------------------------------------------
    // Evidence (002-shared-grc-foundation, US1)
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Action (002-shared-grc-foundation, US2)
    // ---------------------------------------------------------------
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
    // `GET /actions/{actionId}/audit-events` — positioned HERE, after
    // creation, an edit and a transition all happened above, so the trail
    // this sweep scans is not empty (an empty-list sweep passes trivially
    // and scans nothing — see this file's own header).
    await sweep('ActionAuditController_list', () =>
      superAgent.get(`/api/v1/actions/${sharedActionId}/audit-events`).set('Origin', appOrigin),
    );

    // ---------------------------------------------------------------
    // Finding (002-shared-grc-foundation, US3)
    // ---------------------------------------------------------------
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

    // 005-audit-findings, T047-T048 — the operation that finally makes
    // OPEN -> IN_REMEDIATION reachable (SC-002). Swept from an OPEN
    // finding, before any close below moves it past that state.
    await sweep('FindingController_startRemediation', () =>
      superAgent.post(`/api/v1/findings/${findingId}/start-remediation`).set('Origin', appOrigin),
    );

    // 005-audit-findings, T060-T065 — Finding <-> Control / Finding <->
    // Risk (FR-013-FR-016), against the `controlId`/`riskId` fixtures
    // already created above for the Controls/Risk sweeps. Unlinked
    // immediately after — the withdrawn row is what `unlinkFindingFrom*`
    // itself returns (FR-016), not a second, separately-swept read.
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

    // FR-010/005-audit-findings — closing now also requires Invariant F5
    // (at least one ACTIVE evidence link), additive to F1 (justification
    // alone, still sufficient on its own for F1 — `superAgent` is not the
    // responsible user of any linked action, so a justification-only
    // close remains the simplest path through F1 for the sweep's
    // purposes; the segregation-of-duties rule itself, Invariant F2, has
    // its own dedicated coverage in `test/contract/findings.spec.ts`).
    // This evidence is created directly against `findingId` (not swept as
    // a new operationId — `EvidenceController_create`/`linkEvidence` are
    // already swept elsewhere in this file against a different subject).
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
    // Closed a second time (the same operationId, already recorded above)
    // so `archive` below has the CLOSED precondition it requires
    // (Invariant F4) — not a second sweep entry. The evidence link
    // attached above is still ACTIVE (never unlinked), so Invariant F5 is
    // satisfied again without a second evidence fixture.
    await sweep('FindingController_close', () =>
      superAgent
        .post(`/api/v1/findings/${findingId}/close`)
        .set('Origin', appOrigin)
        .send({ justification: 'Encerrado novamente pelo sweep de teste.' }),
    );
    await sweep('FindingController_archive', () =>
      superAgent.post(`/api/v1/findings/${findingId}/archive`).set('Origin', appOrigin),
    );

    // ---------------------------------------------------------------
    // Incident / Problem (008-incidents-problems, US1/US3) — lifecycle
    // CRUD/transition plus the five cross-domain relationship links.
    // ---------------------------------------------------------------
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
    // Read-only reverse of the same row from the Risk side
    // (013-incidents-problems-reverse-links): `modules/risk` never writes
    // `IncidentRiskLink` — `modules/incidents`'s `link-incident-risk.usecase.ts`
    // above owns that write path.
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
    // Read-only reverse of the same row from the Asset side
    // (013-incidents-problems-reverse-links): `modules/assets` never
    // writes `IncidentAssetLink` — `modules/incidents`'s
    // `link-incident-asset.usecase.ts` above owns that write path.
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
    // Read-only reverse of the same row from the Process side
    // (013-incidents-problems-reverse-links): `modules/processes` never
    // writes `IncidentProcessLink` — `modules/incidents`'s
    // `link-incident-process.usecase.ts` above owns that write path.
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
    // Read-only reverse of the same row from the Risk side
    // (013-incidents-problems-reverse-links): `modules/risk` never writes
    // `ProblemRiskLink` — `modules/problems`'s `link-problem-risk.usecase.ts`
    // above owns that write path.
    await sweep('RiskRelationshipController_listProblemLinks', () =>
      superAgent.get(`/api/v1/risks/${riskId}/problems`).set('Origin', appOrigin),
    );
    await sweep('ProblemRelationshipController_unlinkRisk', () =>
      superAgent
        .delete(`/api/v1/problems/${problemId}/risks/${problemRiskLinkId}`)
        .set('Origin', appOrigin),
    );

    // The fifth link — Problem<->Incident, N:M, owned by Problem
    // (research.md D-13 to D-15). Linked here, then read back from BOTH
    // sides: `ProblemRelationshipController_listIncidentLinks` (the write
    // owner's own listing) and
    // `IncidentRelationshipController_listProblemLinks` (the read-only
    // reverse listing `modules/incidents` exposes over the SAME row,
    // resolved via a direct Prisma projection — never a TypeScript import
    // of `modules/problems`).
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

    // ---------------------------------------------------------------
    // Indicators (009-indicators-reports, Fase 3, US1) — placed here, not
    // earlier: `RISK_TOTAL_BY_LEVEL` (chosen because `superAgent` already
    // holds its `sourcePermission`, `risk:view`, and no OTHER file in this
    // suite ever creates a definition for this key — `indicators.spec.ts`
    // only ever READS it — so this create cannot collide with that file's
    // own fixtures under this config's shared, non-truncated database,
    // `fileParallelism: false` / `singleFork: true`) is a `BY_BUCKET`
    // metric over `riskId`'s OWN residual level, set by
    // `AssessmentController_create` above (residualProbability=2,
    // residualImpact=2) and never re-assessed afterward — so by this point
    // in the sequence the bucket the source domain actually returns has
    // one real, non-zero count in it, not an all-zero map a fresh install
    // would also produce. `POST` first, so `GET /indicators` lists a real
    // definition (not an empty catalog) and `GET .../current` reflects it
    // (`definition` non-null) in the same call this sweep already scans.
    // ---------------------------------------------------------------
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
    // 009-indicators-reports, Fase 8 (T068) — `getIndicatorDefinition`/
    // `updateIndicatorDefinition` chain off the SAME definition
    // `IndicatorController_create` above just produced: `getById` reads a
    // real, already-configured record (owner/threshold both real values),
    // and `update` immediately after mutates one real field (`name`) so
    // its own response body is real content too, never a bare echo of an
    // empty PATCH.
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
    // `listIndicatorMetricKeys` — placed after the create/getById/update
    // calls above so `hasDefinition` reflects a real, just-configured key
    // (`RISK_TOTAL_BY_LEVEL`) rather than an all-`false` catalog.
    await sweep('IndicatorController_listMetricKeys', () =>
      superAgent.get('/api/v1/indicators/metric-keys').set('Origin', appOrigin),
    );

    // 009-indicators-reports, Fase 4 (US2) — `superAgent` already holds a
    // `GLOBAL` `OrgScopeGrant` (this file's own `beforeAll`, above) and
    // every permission, so it satisfies research.md D-6's double gate
    // (`indicator:edit`/`indicator:view` PLUS `ScopeFilter.kind ===
    // 'GLOBAL'`) without a dedicated fixture. `POST` first, so the `GET`
    // right after it sweeps a series with one real row in it — never an
    // empty list, which would scan no content at all (this task's own
    // instructions, and `IndicatorController_create`'s comment above makes
    // the same point for `GET /indicators`).
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

    // ---------------------------------------------------------------
    // Reports (009-indicators-reports, Fase 7, US5) — placed here, right
    // after Indicators, for the same reason `IndicatorController_create`'s
    // own comment above gives: `POST` first, so `GET /reports` lists a
    // real definition (not an empty catalog) and both `GET .../run` calls
    // compute against metrics that already have real, non-zero content —
    // `RISK_TOTAL_BY_LEVEL` reflects `riskId`'s own residual level (set by
    // `AssessmentController_create` above and never re-assessed since),
    // and `CONTROL_INACTIVE_COUNT` reflects `controlId`'s own row (created
    // in this file's own `beforeAll`, `status` left at its default —
    // non-ACTIVE, so it counts). `superAgent` holds every permission
    // (`report:view`/`report:create` plus every metric's own
    // `sourcePermission`), so both items compute as `available: true` —
    // this sweep's job is scanning real response CONTENT for a disclosure
    // defect, not exercising SC-006's partial-permission branch (that is
    // `test/contract/reports.spec.ts`'s own job). `GET .../run` is swept
    // TWICE under the same `ReportController_run` operationId — once for
    // the default JSON body, once for `format=csv` — because this sweep
    // scans the response BODY, and the `text/csv` branch is a genuinely
    // different body needing its own scan; both calls share one
    // operationId (there is only one registered route), so this does not
    // add a second entry to the exhaustiveness assertion at the bottom of
    // this file.
    // ---------------------------------------------------------------
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
    // 009-indicators-reports, Fase 8 (T068) — `getReportDefinition`/
    // `updateReportDefinition` chain off `sweepReportId`, the SAME
    // definition `ReportController_create` above just produced: `getById`
    // reads a real, already-configured record, and `update` immediately
    // after mutates one real field (`name`).
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

    // ---------------------------------------------------------------
    // Dashboard summary (`GET /dashboard/summary`, `modules/dashboard`) —
    // placed here, AFTER every other business-domain section above (Risk,
    // Controls, Compliance, Audit Engagements/Findings, Assets/Processes,
    // Incidents/Problems, Indicators, Reports), so `superAgent` (every
    // permission, GLOBAL scope) sweeps a response with REAL, non-empty
    // content behind every one of the eleven `IndicatorMetricKey`s this
    // endpoint's `metrics` array can carry — not an empty catalog that
    // would scan nothing. `RISK_TOTAL_BY_LEVEL` reflects the risk assessed
    // above, `CONTROL_INACTIVE_COUNT` reflects `controlId`'s own row
    // (created in this file's own `beforeAll`, left at its default
    // non-ACTIVE status), and so on for every other domain this sweep has
    // already produced data in by this point in the file.
    // ---------------------------------------------------------------
    await sweep('DashboardSummaryController_getSummary', () =>
      superAgent.get('/api/v1/dashboard/summary').set('Origin', appOrigin),
    );

    // ---------------------------------------------------------------
    // Comments / attachments
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Notifications
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Admin: org units
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Admin: permissions / roles
    // ---------------------------------------------------------------
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
    // 2026-09-13 (015-roles-permissions-surface): `GET
    // /admin/roles/summary`. Four integers and nothing else — but it is
    // swept like every other route, because the exhaustiveness assertion
    // at the bottom of this file compares against `openapi.json` and an
    // unswept route fails there by name. That assertion is the reason this
    // entry is not optional.
    await sweep('AdminRolesController_summary', () =>
      superAgent.get('/api/v1/admin/roles/summary').set('Origin', appOrigin),
    );
    await sweep('AdminRolesController_update', () =>
      superAgent
        .patch(`/api/v1/admin/roles/${disposableRoleId}`)
        .set('Origin', appOrigin)
        .send({ description: 'Papel de teste do sweep (atualizado).' }),
    );

    // ---------------------------------------------------------------
    // Admin: users (target a DISPOSABLE user, never superAgent's own)
    // ---------------------------------------------------------------
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

    // Unassign before delete — `RoleAdminService` refuses to delete a role
    // still assigned to a user (`roleHasAssignedUsers`), by design.
    await superAgent
      .put(`/api/v1/admin/users/${adminTargetUserId}/roles`)
      .set('Origin', appOrigin)
      .send({ roleIds: [] });
    await sweep('AdminRolesController_delete', () =>
      superAgent.delete(`/api/v1/admin/roles/${disposableRoleId}`).set('Origin', appOrigin),
    );

    // ---------------------------------------------------------------
    // Session-disruptive calls — the disposable agent/user only, last.
    // ---------------------------------------------------------------
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

    // A route present in the real, reflected router but missing from this
    // sweep fails HERE, by name — not silently. See file header.
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
      // `sessionId` is a DECLARED column on `audit_event`
      // (data-model.md/ADR-005) storing the SESSION'S OWN id (a plain
      // uuid), never the session token or its hash — legitimate audit
      // metadata, not a disclosure. The check below still applies every
      // OTHER pattern to it (it must never itself look like a token hash
      // or a raw token).
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
    // A final, human-readable summary — if any of the three checks above
    // failed, this test (which always runs) prints exactly what was found
    // and where, rather than leaving the coordinator to re-derive it from
    // a bare "expected [] to equal [...]" diff.
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

    // Not weakened for the sweep: still scan the REDACTED output itself for
    // every disclosure pattern, proving redaction genuinely removes the
    // dangerous content rather than merely renaming the key.
    scanJsonValue('sanitizeLogMeta-output', undefined, output);
  });
});
