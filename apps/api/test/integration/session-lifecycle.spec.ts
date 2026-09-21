/**
 * T052 — session lifecycle against real PostgreSQL: creation, idle expiry,
 * absolute expiry, revocation, logout (ADR-002, FR-012 to FR-017).
 *
 * Idle/absolute expiry are exercised by directly backdating the persisted
 * `lastActivityAt`/`expiresAt` columns (rather than mocking the clock) —
 * `SessionService.validateSession` reads those columns (via the cache or a
 * DB fallback) and computes expiry from `Date.now()`, so backdating the
 * stored values is a faithful, real-database way to simulate the passage
 * of time without coupling the test to fake-timer plumbing.
 */
import { AuthenticationMethod, SessionRevocationReason } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthUseCasesPort } from '../../src/core/identity/domain/ports/auth-use-cases.port';
import { IdentityModule } from '../../src/core/identity/identity.module';
import { SessionService } from '../../src/core/sessions/application/session.service';
import { SessionCachePort } from '../../src/core/sessions/domain/ports/session-cache.port';
import { hashSessionToken } from '../../src/core/sessions/domain/session-cookie';
import { SessionsModule } from '../../src/core/sessions/sessions.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';

import { createLocalUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('Session lifecycle (T052, ADR-002, FR-012 to FR-017)', () => {
  let ctx: IntegrationTestContext;
  let authUseCases: AuthUseCasesPort;
  let sessionService: SessionService;
  let sessionCache: SessionCachePort;
  let appConfig: AppConfigService;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, IdentityModule, SessionsModule],
    });
    authUseCases = ctx.app.get(AuthUseCasesPort);
    sessionService = ctx.app.get(SessionService);
    sessionCache = ctx.app.get(SessionCachePort);
    appConfig = ctx.app.get(AppConfigService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creates a session with the expected metadata on successful login (FR-012, FR-013)', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);

    const outcome = await authUseCases.login({
      email: fixture.user.email,
      password: fixture.rawPassword,
      ipAddress: '203.0.113.10',
      userAgent: 'vitest-session-lifecycle',
    });

    expect(outcome.session.authenticationMethod).toBe(AuthenticationMethod.LOCAL);
    expect(outcome.session.ipAddress).toBe('203.0.113.10');
    expect(outcome.session.userAgent).toBe('vitest-session-lifecycle');

    const row = await ctx.prisma.client.session.findFirst({ where: { userId: fixture.user.id } });
    expect(row).not.toBeNull();
    expect(row?.revokedAt).toBeNull();
    expect(row?.tokenHash).not.toBe(outcome.rawToken); // never the raw value

    const validation = await sessionService.validateSession(outcome.rawToken);
    expect(validation.valid).toBe(true);
    if (validation.valid) {
      expect(validation.session.userId).toBe(fixture.user.id);
    }
  });

  it('expires a session after the configured idle timeout and refuses it thereafter (FR-014, FR-015)', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);
    const outcome = await authUseCases.login({
      email: fixture.user.email,
      password: fixture.rawPassword,
      ipAddress: undefined,
      userAgent: undefined,
    });

    const row = await ctx.prisma.client.session.findFirst({ where: { userId: fixture.user.id } });
    expect(row).not.toBeNull();

    const staleLastActivity = new Date(
      Date.now() - (appConfig.session.idleTimeoutMinutes + 1) * 60_000,
    );
    await ctx.prisma.client.session.update({
      where: { id: row!.id },
      data: { lastActivityAt: staleLastActivity },
    });
    // `authUseCases.login` already warmed the validation cache with the
    // FRESH `lastActivityAt`. Real traffic never diverges the cache from
    // the database like this direct backdating does (every real write path
    // goes through `SessionService`, which keeps both in sync) — evicting
    // the now-stale cache entry here simply forces the next call onto the
    // authoritative PostgreSQL fallback path, which is what a real idle
    // timeout elapsing over real wall-clock time would naturally do too
    // (the cache TTL, `SESSION_CACHE_TTL_SECONDS`, is far shorter than any
    // realistic idle timeout).
    await sessionCache.del(hashSessionToken(outcome.rawToken));

    const validation = await sessionService.validateSession(outcome.rawToken);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.reason).toBe('EXPIRED');
    }

    const revokedRow = await ctx.prisma.client.session.findUnique({ where: { id: row!.id } });
    expect(revokedRow?.revokedAt).not.toBeNull();
    expect(revokedRow?.revokedReason).toBe(SessionRevocationReason.EXPIRED);

    // Refused on the NEXT request too (not just the one that discovered it).
    const secondValidation = await sessionService.validateSession(outcome.rawToken);
    expect(secondValidation.valid).toBe(false);
  });

  it('expires a session after its absolute lifetime even with recent activity (FR-014)', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);
    const outcome = await authUseCases.login({
      email: fixture.user.email,
      password: fixture.rawPassword,
      ipAddress: undefined,
      userAgent: undefined,
    });

    const row = await ctx.prisma.client.session.findFirst({ where: { userId: fixture.user.id } });
    await ctx.prisma.client.session.update({
      where: { id: row!.id },
      data: { expiresAt: new Date(Date.now() - 1_000), lastActivityAt: new Date() },
    });
    await sessionCache.del(hashSessionToken(outcome.rawToken)); // see idle-expiry test's comment above

    const validation = await sessionService.validateSession(outcome.rawToken);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.reason).toBe('EXPIRED');
    }

    const revokedRow = await ctx.prisma.client.session.findUnique({ where: { id: row!.id } });
    expect(revokedRow?.revokedReason).toBe(SessionRevocationReason.EXPIRED);
  });

  it('refuses a session immediately after explicit revocation, and a stale cache entry never resurrects it', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);
    const outcome = await authUseCases.login({
      email: fixture.user.email,
      password: fixture.rawPassword,
      ipAddress: undefined,
      userAgent: undefined,
    });
    // Prime the cache with a valid read first (mirrors a real second
    // request), THEN revoke — proving revocation invalidates the cache
    // entry it just warmed, not merely the database row.
    const primed = await sessionService.validateSession(outcome.rawToken);
    expect(primed.valid).toBe(true);

    const row = await ctx.prisma.client.session.findFirst({ where: { userId: fixture.user.id } });
    // `SessionService.revokeSession` audits atomically (ADR-005) — it must
    // be called from inside an ambient transaction, exactly as
    // `AuthOrchestrator.logout` does in production; this test opens one
    // explicitly since it calls the service directly.
    await ctx.prisma.runInTransaction(() =>
      sessionService.revokeSession(row!.id, SessionRevocationReason.ADMIN_REVOKED, 'Test Admin'),
    );

    const afterRevoke = await sessionService.validateSession(outcome.rawToken);
    expect(afterRevoke.valid).toBe(false);
    if (!afterRevoke.valid) {
      expect(afterRevoke.reason).toBe('REVOKED');
    }
  });

  it('terminates the session on logout and refuses the same cookie afterward (FR-015, FR-016)', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);
    const outcome = await authUseCases.login({
      email: fixture.user.email,
      password: fixture.rawPassword,
      ipAddress: undefined,
      userAgent: undefined,
    });
    const row = await ctx.prisma.client.session.findFirst({ where: { userId: fixture.user.id } });

    await authUseCases.logout({ sessionId: row!.id, actorLabel: fixture.user.fullName });

    const afterLogout = await sessionService.validateSession(outcome.rawToken);
    expect(afterLogout.valid).toBe(false);

    const revokedRow = await ctx.prisma.client.session.findUnique({ where: { id: row!.id } });
    expect(revokedRow?.revokedReason).toBe(SessionRevocationReason.LOGOUT);
  });
});
