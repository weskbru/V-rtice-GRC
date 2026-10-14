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

const VALID_NEW_PASSWORD = 'NewValid-Passw0rd!23';
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
    const setCookieHeader = response.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const setCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : String(setCookieHeader);
    expect(setCookie).toMatch(/vgrc_session=;/);

    const sessionCheck = await agent.get('/api/v1/auth/session').set('Origin', appOrigin);
    expect(sessionCheck.status).toBe(401);

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
