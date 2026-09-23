import { AuditEntityType, AuditOutcome, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthUseCasesPort } from '../../src/core/identity/domain/ports/auth-use-cases.port';
import { IdentityModule } from '../../src/core/identity/identity.module';
import { SessionService } from '../../src/core/sessions/application/session.service';
import { SessionsModule } from '../../src/core/sessions/sessions.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { UnauthorizedDomainError } from '../../src/shared/errors/domain-error';

import { createLocalUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('User deactivation (T055, FR-011, FR-017)', () => {
  let ctx: IntegrationTestContext;
  let authUseCases: AuthUseCasesPort;
  let sessionService: SessionService;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, IdentityModule, SessionsModule],
    });
    authUseCases = ctx.app.get(AuthUseCasesPort);
    sessionService = ctx.app.get(SessionService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('revokes every active session immediately when the user is deactivated', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);

    const first = await authUseCases.login({
      email: fixture.user.email,
      password: fixture.rawPassword,
      ipAddress: undefined,
      userAgent: undefined,
    });
    const second = await authUseCases.login({
      email: fixture.user.email,
      password: fixture.rawPassword,
      ipAddress: undefined,
      userAgent: undefined,
    });

    expect((await sessionService.validateSession(first.rawToken)).valid).toBe(true);
    expect((await sessionService.validateSession(second.rawToken)).valid).toBe(true);

    await authUseCases.deactivateUser({ userId: fixture.user.id, actorLabel: 'Test Admin' });

    expect((await sessionService.validateSession(first.rawToken)).valid).toBe(false);
    expect((await sessionService.validateSession(second.rawToken)).valid).toBe(false);

    const sessions = await ctx.prisma.client.session.findMany({
      where: { userId: fixture.user.id },
    });
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
    expect(sessions.every((session) => session.revokedReason === 'USER_DEACTIVATED')).toBe(true);
  });

  it('blocks further authentication with the correct password once deactivated', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);

    await authUseCases.deactivateUser({ userId: fixture.user.id, actorLabel: 'Test Admin' });

    await expect(
      authUseCases.login({
        email: fixture.user.email,
        password: fixture.rawPassword,
        ipAddress: undefined,
        userAgent: undefined,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedDomainError);

    const user = await ctx.prisma.client.user.findUnique({ where: { id: fixture.user.id } });
    expect(user?.status).toBe(UserStatus.INACTIVE);
  });

  it('audits the deactivation itself as a USER event with previous/new status', async () => {
    const fixture = await createLocalUserFixture(ctx.prisma);

    await authUseCases.deactivateUser({ userId: fixture.user.id, actorLabel: 'Test Admin' });

    const rows = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.USER,
        entityId: fixture.user.id,
        action: 'user.deactivated',
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.outcome).toBe(AuditOutcome.SUCCESS);
    expect(rows[0]!.previousValues).toMatchObject({ status: 'ACTIVE' });
    expect(rows[0]!.newValues).toMatchObject({ status: 'INACTIVE' });
    expect(rows[0]!.actorLabel).toBe('Test Admin');
  });
});
