/**
 * T053 — audit events for login, FAILED login, logout and revocation
 * (FR-018), against real PostgreSQL. Each assertion scopes its query by a
 * unique marker (the fixture user's own id/email) rather than assuming
 * `audit_event` is empty, per this harness's established convention.
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType, AuditOutcome, SessionRevocationReason } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthUseCasesPort } from '../../src/core/identity/domain/ports/auth-use-cases.port';
import { IdentityModule } from '../../src/core/identity/identity.module';
import { SessionService } from '../../src/core/sessions/application/session.service';
import { SessionCachePort } from '../../src/core/sessions/domain/ports/session-cache.port';
import { hashSessionToken } from '../../src/core/sessions/domain/session-cookie';
import { SessionsModule } from '../../src/core/sessions/sessions.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { RequestContextStore } from '../../src/infrastructure/logging/request-context';

import { createLocalUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('Authentication/session audit trail (T053, FR-018)', () => {
  let ctx: IntegrationTestContext;
  let authUseCases: AuthUseCasesPort;
  let sessionService: SessionService;
  let sessionCache: SessionCachePort;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, IdentityModule, SessionsModule],
    });
    authUseCases = ctx.app.get(AuthUseCasesPort);
    sessionService = ctx.app.get(SessionService);
    sessionCache = ctx.app.get(SessionCachePort);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('audits a successful login as a SESSION creation event', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);

    // This harness resolves `AuthUseCasesPort` directly (no HTTP listener,
    // see test-app.ts's header), so `RequestContextMiddleware` — which
    // establishes the per-request `AsyncLocalStorage` context in the real
    // app — never runs here. Without it, `RequestContextEnricherPort
    // .enrich(...)` legitimately no-ops (no ambient context to enrich into,
    // same as outside any request), and this test would fail for a reason
    // unrelated to whether the production fix is correct. Wrapping the call
    // in the SAME `RequestContextStore.run(...)` the real middleware uses
    // (precedent: `audit-transactional.spec.ts`) simulates exactly that one
    // piece of infrastructure, deliberately WITHOUT pre-seeding
    // `actorUserId`/`sessionId` — proving the login path itself is what
    // populates them, not the test setup.
    await RequestContextStore.run(
      {
        correlationId: randomUUID(),
        ipAddress: '198.51.100.5',
        userAgent: 'vitest-session-audit',
        method: 'POST',
        path: '/test/session-audit',
      },
      () =>
        authUseCases.login({
          email: fixture.user.email,
          password: fixture.rawPassword,
          ipAddress: '198.51.100.5',
          userAgent: 'vitest-session-audit',
        }),
    );

    const session = await ctx.prisma.client.session.findFirst({
      where: { userId: fixture.user.id },
    });
    const rows = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.SESSION,
        entityId: session!.id,
        action: 'session.created',
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.outcome).toBe(AuditOutcome.SUCCESS);
    expect(rows[0]!.actorLabel).toBe(fixture.user.fullName);
    expect(rows[0]!.newValues).toMatchObject({ authenticationMethod: 'LOCAL' });
    // Never the raw or hashed token in the audit payload (FR-107/FR-108).
    expect(JSON.stringify(rows[0]!.newValues)).not.toMatch(/tokenHash|token_hash/i);

    // D-13/V2/FR-026, regression: measured directly against the dev
    // database, EVERY historical `session.created` row (1466/1466) had
    // `actor_user_id`/`session_id` NULL — login is `@Public()`, so
    // `SessionGuard` (the only other caller of
    // `RequestContextEnricherPort.enrich`) never runs on it, while
    // `ip_address`/`user_agent` were already populated by
    // `RequestContextMiddleware` regardless of guards. This asserts the
    // ROW ITSELF carries the real, server-resolved identity (never a
    // client-supplied value) — not merely that some enrichment function was
    // invoked. Fails against the code before `SessionService.createSession`
    // enriches the request context; passes after.
    expect(rows[0]!.actorUserId).toBe(fixture.user.id);
    expect(rows[0]!.sessionId).toBe(session!.id);
  });

  it('audits a FAILED login attempt with a FAILURE outcome, never a password/hash value', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);

    await expect(
      authUseCases.login({
        email: fixture.user.email,
        password: 'definitely-wrong-password',
        ipAddress: '198.51.100.6',
        userAgent: 'vitest-session-audit',
      }),
    ).rejects.toThrow();

    const rows = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.USER,
        actorLabel: fixture.user.email,
        outcome: AuditOutcome.FAILURE,
      },
    });

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[rows.length - 1]!;
    expect(row.action).toBe('auth.login_failed');
    const payload = JSON.stringify(row);
    expect(payload).not.toMatch(/password/i);
    expect(payload).not.toMatch(/hash/i);
  });

  it('audits logout as a session revocation event with reason LOGOUT', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);
    await authUseCases.login({
      email: fixture.user.email,
      password: fixture.rawPassword,
      ipAddress: undefined,
      userAgent: undefined,
    });
    const session = await ctx.prisma.client.session.findFirst({
      where: { userId: fixture.user.id },
    });

    await authUseCases.logout({ sessionId: session!.id, actorLabel: fixture.user.fullName });

    const rows = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.SESSION, entityId: session!.id, action: 'auth.logout' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.newValues).toMatchObject({ revokedReason: 'LOGOUT' });
  });

  it('audits an explicit (e.g. admin) revocation distinctly from logout', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);
    await authUseCases.login({
      email: fixture.user.email,
      password: fixture.rawPassword,
      ipAddress: undefined,
      userAgent: undefined,
    });
    const session = await ctx.prisma.client.session.findFirst({
      where: { userId: fixture.user.id },
    });

    // Must run inside an ambient transaction (ADR-005) — `AuthOrchestrator`
    // provides one in production; this test calls the service directly.
    await ctx.prisma.runInTransaction(() =>
      sessionService.revokeSession(
        session!.id,
        SessionRevocationReason.ADMIN_REVOKED,
        'Test Admin',
      ),
    );

    const rows = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.SESSION,
        entityId: session!.id,
        action: 'session.revoked',
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actorLabel).toBe('Test Admin');
    expect(rows[0]!.newValues).toMatchObject({ revokedReason: 'ADMIN_REVOKED' });
  });

  it('audits lazily-discovered expiry as a distinct event', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);
    const outcome = await authUseCases.login({
      email: fixture.user.email,
      password: fixture.rawPassword,
      ipAddress: undefined,
      userAgent: undefined,
    });
    const session = await ctx.prisma.client.session.findFirst({
      where: { userId: fixture.user.id },
    });
    await ctx.prisma.client.session.update({
      where: { id: session!.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    // See session-lifecycle.spec.ts's comment: real traffic never diverges
    // the cache from the database like this direct backdating does; evict
    // the now-stale cache entry so the fallback reads the backdated row.
    await sessionCache.del(hashSessionToken(outcome.rawToken));

    await sessionService.validateSession(outcome.rawToken);

    const rows = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.SESSION,
        entityId: session!.id,
        action: 'session.expired',
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.newValues).toMatchObject({ revokedReason: 'EXPIRED' });
  });
});
