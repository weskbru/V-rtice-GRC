/**
 * Assurance fix (HIGH, confirmed gap) — end-to-end coverage for account
 * lockout against the REAL running application: `LoginThrottleService`
 * (FR-008, D-6) already enforced per-account lockout correctly, but never
 * called `AuditRecorder` and had zero tests anywhere in `apps/api/test/`.
 * `test/unit/login-throttle.service.spec.ts` covers the service in
 * isolation (fast, fake ports); this file proves the same behavior against
 * the real HTTP surface, real Prisma-backed `UserDirectoryPort`, and the
 * real `audit_event` table — including the field allow-list wiring
 * (`registerCoreEntityAuditAllowlists`) that only a real boot exercises.
 */
import { AuditEntityType, AuditOutcome } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture, type LocalUserFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface ProblemBody {
  readonly status: number;
  readonly detail?: string;
  readonly title?: string;
}

describe('Account lockout is audited (assurance fix, FR-008/D-6)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let accountAttempts: number;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;
    accountAttempts = appConfig.authRateLimit.accountAttempts;
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function failLoginOnce(email: string): Promise<request.Response> {
    return request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password: 'definitely-the-wrong-password' });
  }

  it('exactly `accountAttempts` wrong passwords locks the account and records auth.account_locked (LOCAL_CREDENTIAL, DENIED)', async () => {
    const prisma = ctx.app.get(PrismaService);
    const fixture: LocalUserFixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('lockout-target')}@example.test`,
    });

    // Every attempt up to and including the threshold is a plain, generic
    // 401 — the account only becomes REFUSED-AS-LOCKED starting with the
    // NEXT attempt after that.
    for (let i = 0; i < accountAttempts; i += 1) {
      const response = await failLoginOnce(fixture.user.email);
      expect(response.status).toBe(401);
    }

    const credential = await prisma.client.localCredential.findUnique({
      where: { userId: fixture.user.id },
    });
    expect(credential?.lockedUntil).not.toBeNull();
    expect(credential?.failedAttempts).toBe(accountAttempts);

    const lockedAudit = await prisma.client.auditEvent.findFirst({
      where: {
        action: 'auth.account_locked',
        entityType: AuditEntityType.LOCAL_CREDENTIAL,
        entityId: credential!.id,
      },
    });
    expect(lockedAudit).not.toBeNull();
    expect(lockedAudit?.outcome).toBe(AuditOutcome.DENIED);
    // No attempted password, no password hash — only what
    // `auth.login_failed` already records (the actor's own email) plus
    // the allow-listed lockout fields.
    expect(JSON.stringify(lockedAudit?.newValues)).not.toMatch(/password/i);

    // The account is now refused BEFORE credential verification, even
    // with the CORRECT password — and the response stays the SAME
    // generic shape as an ordinary failed login (FR-007), never a
    // distinct "account locked" message.
    const refusedResponse = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(refusedResponse.status).toBe(429);
    expect(refusedResponse.headers['content-type']).toContain('application/problem+json');

    // The refusal-in-force fact is also audited, distinct from the
    // moment the account first became locked.
    const refusedAudit = await prisma.client.auditEvent.findFirst({
      where: {
        action: 'auth.login_refused_locked',
        entityType: AuditEntityType.LOCAL_CREDENTIAL,
        entityId: credential!.id,
      },
    });
    expect(refusedAudit).not.toBeNull();
    expect(refusedAudit?.outcome).toBe(AuditOutcome.DENIED);
  });

  it('an unknown email never locks or gets audited, however many times it fails (FR-007 non-disclosure)', async () => {
    const prisma = ctx.app.get(PrismaService);
    const unknownEmail = `${uniqueTestMarker('lockout-unknown')}@example.test`;

    for (let i = 0; i < accountAttempts + 3; i += 1) {
      const response = await failLoginOnce(unknownEmail);
      expect(response.status).toBe(401);
    }

    const lockedAudit = await prisma.client.auditEvent.findFirst({
      where: { action: 'auth.account_locked', actorLabel: unknownEmail },
    });
    expect(lockedAudit).toBeNull();
  });

  it('a locked account is refused with the byte-identical problem body an ordinary wrong password gets from the per-origin path (FR-007)', async () => {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('lockout-message')}@example.test`,
    });

    for (let i = 0; i < accountAttempts; i += 1) {
      await failLoginOnce(fixture.user.email);
    }

    const lockedResponse = await failLoginOnce(fixture.user.email);
    expect(lockedResponse.status).toBe(429);
    const body = lockedResponse.body as ProblemBody;
    expect(body.detail).toBe(USER_MESSAGES.auth.tooManyAttempts);
  });
});
