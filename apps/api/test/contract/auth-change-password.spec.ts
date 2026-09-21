/**
 * D-11 gap-coverage — `POST /auth/me/password` (`AuthController.
 * changeOwnPassword`, `contracts/auth.openapi.yaml` ~144) had NO test
 * anywhere in the repository before this dispatch, found by the same
 * coverage audit that surfaced the untested `/risk-methodology` and
 * `GET /users` endpoints (see `risk-methodology.spec.ts`/
 * `directory-users.spec.ts`'s own header comments).
 *
 * The contract: "Requires an authenticated session and a local credential;
 * no additional permission" — proven below with a zero-permission actor,
 * same as every other D-11 closure in this dispatch.
 *
 * ## CSRF (ADR-002) — deliberate, not a defect
 *
 * This is a state-changing POST, so `CsrfMiddleware` requires `Origin` on
 * every request, including the ones this file expects to fail for an
 * UNRELATED reason (wrong password, policy violation, missing session).
 * Every request below sets `Origin` explicitly so the assertions exercise
 * `SessionGuard`/the use case, not `CsrfMiddleware`'s own unrelated 403 —
 * exactly the caution `risk-methodology.spec.ts`'s 401 test already
 * documents for `POST /risk-methodology/versions`.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture, FIXTURE_USER_PASSWORD } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly errors?: readonly { readonly field: string; readonly message: string }[];
}

/** Meets the configured policy (PASSWORD_MIN_LENGTH=12,
 * PASSWORD_REQUIRE_COMPLEXITY=true — apps/api/.env — at least 3 of 4
 * character classes) and is distinct from `FIXTURE_USER_PASSWORD`. */
const VALID_NEW_PASSWORD = 'NewValid-Passw0rd!23';
/**
 * Meets `ChangePasswordRequestDto`'s own `@Length(12, 256)` (so the request
 * reaches the domain-level `validatePassword` check at all, rather than
 * being rejected 400 by the `ValidationPipe` first) but is all lowercase —
 * only ONE of the four character classes `validatePassword`
 * (`password-policy.ts`) checks, short of the `MIN_COMPLEXITY_CLASSES_
 * PRESENT` (3) the configured policy (`PASSWORD_REQUIRE_COMPLEXITY=true`)
 * requires. Exercises the 422 `MISSING_COMPLEXITY` policy path
 * specifically — the length floor (12) is not independently reachable via
 * HTTP here, since the DTO's own floor is identical to the configured
 * policy's.
 */
const POLICY_VIOLATING_PASSWORD = 'alllowercase';

describe('POST /auth/me/password — change own password (contracts/auth.openapi.yaml ~144)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function loginAsFreshActor(): Promise<{
    agent: ReturnType<typeof request.agent>;
    email: string;
  }> {
    const prisma = ctx.app.get(PrismaService);
    // No role assigned at all — the contract requires "no additional
    // permission", so this is deliberately a zero-permission actor, not an
    // administrator.
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('change-password-actor')}@example.test`,
    });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, email: fixture.user.email };
  }

  it('refuses an unauthenticated caller with 401 (Origin set, so this is SessionGuard, not CsrfMiddleware)', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/me/password')
      .set('Origin', appOrigin)
      .send({ currentPassword: FIXTURE_USER_PASSWORD, newPassword: VALID_NEW_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(401);
  });

  it('a missing Origin is refused with 403 by CsrfMiddleware, BEFORE SessionGuard ever runs — not a defect, ADR-002', async () => {
    // No .set('Origin', ...) at all, and no session cookie either — proves
    // the 403 fires ahead of, and independently of, authentication.
    const response = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/me/password')
      .send({ currentPassword: FIXTURE_USER_PASSWORD, newPassword: VALID_NEW_PASSWORD });

    expect(response.status).toBe(403);
  });

  it('refuses a wrong current password with 401 and the canonical, non-disclosing pt-BR message', async () => {
    const { agent } = await loginAsFreshActor();

    const response = await agent
      .post('/api/v1/auth/me/password')
      .set('Origin', appOrigin)
      .send({ currentPassword: 'Definitely-Wrong-Passw0rd!', newPassword: VALID_NEW_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(401);
    // The canonical catalog string (apps/api/src/shared/messages/user-messages.ts)
    // — never a bespoke inline message, and never something that discloses
    // more than "the current password is wrong" (e.g. it must not say
    // whether the account/credential itself exists).
    expect(body.detail).toBe(USER_MESSAGES.auth.currentPasswordIncorrect);
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/stack/i);
    expect(raw).not.toMatch(/prisma/i);
    expect(raw).not.toMatch(/passwordHash/i);
  });

  it('refuses a new password violating the password policy with 422 and a newPassword field error', async () => {
    const { agent } = await loginAsFreshActor();

    const response = await agent
      .post('/api/v1/auth/me/password')
      .set('Origin', appOrigin)
      .send({ currentPassword: FIXTURE_USER_PASSWORD, newPassword: POLICY_VIOLATING_PASSWORD });

    expect(response.status).toBe(422);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.body as ProblemBody;
    expect(body.status).toBe(422);
    expect(body.detail).toBe(USER_MESSAGES.auth.passwordPolicyViolation);
    expect(body.errors).toBeDefined();
    expect(body.errors?.some((error) => error.field === 'newPassword')).toBe(true);
  });

  it('succeeds for a zero-permission authenticated user with the correct current password (204), and revokes the session (FR-017)', async () => {
    const prisma = ctx.app.get(PrismaService);
    const { agent, email } = await loginAsFreshActor();

    const response = await agent
      .post('/api/v1/auth/me/password')
      .set('Origin', appOrigin)
      .send({ currentPassword: FIXTURE_USER_PASSWORD, newPassword: VALID_NEW_PASSWORD });

    expect(response.status).toBe(204);
    // "the cookie cleared" (contract).
    const setCookieHeader = response.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const setCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : String(setCookieHeader);
    expect(setCookie).toMatch(/pgrc_session=;/);

    // FR-017: the request's OWN session — not just future ones — is
    // revoked, so the same cookie the request used no longer authenticates
    // a follow-up call.
    const sessionCheck = await agent.get('/api/v1/auth/session').set('Origin', appOrigin);
    expect(sessionCheck.status).toBe(401);

    // The old password can no longer authenticate a fresh login, and the
    // new one can — proving the update actually persisted, not merely that
    // the HTTP call returned 204.
    const loginWithOldPassword = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password: FIXTURE_USER_PASSWORD });
    expect(loginWithOldPassword.status).toBe(401);

    const loginWithNewPassword = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password: VALID_NEW_PASSWORD });
    expect(loginWithNewPassword.status).toBe(200);

    // Audited without any credential material (FR-010, FR-035).
    const auditRow = await prisma.client.auditEvent.findFirst({
      where: { action: 'auth.password_changed' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(auditRow).not.toBeNull();
    const auditRaw = JSON.stringify(auditRow);
    expect(auditRaw).not.toMatch(/passwordHash/i);
    expect(auditRaw).not.toBe(FIXTURE_USER_PASSWORD);
    expect(auditRaw).not.toContain(VALID_NEW_PASSWORD);
  });
});
